"""
Source Credibility Service
Evaluates trustworthiness of content sources (URLs, domains)
"""
import re
import ssl
import socket
from datetime import datetime
from urllib.parse import urlparse
from typing import Dict, Any, Optional, List

import requests

from config import GOOGLE_FACTCHECK_API_KEY
from models.schemas import SourceResult

# Try to import whois - optional
try:
    import whois
    WHOIS_AVAILABLE = True
except ImportError:
    WHOIS_AVAILABLE = False
    print("Warning: python-whois not installed. Domain age checks will be skipped.")


# Known suspicious patterns
SUSPICIOUS_URL_PATTERNS = [
    (r'\d{6,}', "Contains long number sequences"),
    (r'[^\w\-\.\/:@]', "Contains unusual characters"),
    (r'(news|breaking|alert|update)\d+\.(com|net|org)', "Suspicious news site pattern"),
    (r'\.(tk|ml|ga|cf|gq)$', "Free domain extension (often abused)"),
    (r'(amaz0n|g00gle|faceb00k|paypai)', "Possible typosquatting"),
    (r'\-\-+', "Multiple consecutive hyphens"),
]

# Known reputable domains (simplified list)
REPUTABLE_DOMAINS = [
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk",
    "nytimes.com", "washingtonpost.com", "theguardian.com",
    "cnn.com", "npr.org", "pbs.org", "abc.net.au",
    "france24.com", "dw.com", "aljazeera.com"
]


def check_domain_age(domain: str) -> Optional[int]:
    """Check domain registration age in days."""
    if not WHOIS_AVAILABLE:
        return None
    
    try:
        w = whois.whois(domain)
        creation_date = w.creation_date
        
        if creation_date:
            if isinstance(creation_date, list):
                creation_date = creation_date[0]
            
            age_days = (datetime.now() - creation_date).days
            return max(0, age_days)
    except:
        pass
    
    return None


def check_ssl_certificate(domain: str, timeout: int = 5) -> Dict[str, Any]:
    """Check if domain has valid SSL certificate."""
    result = {
        "has_ssl": False,
        "ssl_valid": False,
        "issuer": None
    }
    
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                result["has_ssl"] = True
                result["ssl_valid"] = True
                
                # Extract issuer
                issuer = dict(x[0] for x in cert.get("issuer", []))
                result["issuer"] = issuer.get("organizationName", "Unknown")
                
    except ssl.SSLError as e:
        result["has_ssl"] = True
        result["ssl_valid"] = False
        result["error"] = str(e)
    except Exception as e:
        result["error"] = str(e)
    
    return result


def detect_suspicious_patterns(url: str) -> List[str]:
    """Detect suspicious patterns in URL."""
    suspicious = []
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        full_url = url.lower()
        
        for pattern, reason in SUSPICIOUS_URL_PATTERNS:
            if re.search(pattern, domain) or re.search(pattern, full_url):
                suspicious.append(reason)
        
        # Check for IP address instead of domain
        if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', domain):
            suspicious.append("Uses IP address instead of domain name")
        
        # Check for excessive subdomains
        subdomain_count = domain.count('.') - 1
        if subdomain_count > 3:
            suspicious.append(f"Excessive subdomains ({subdomain_count})")
        
        # Very long domain
        if len(domain) > 50:
            suspicious.append("Unusually long domain name")
            
    except Exception as e:
        suspicious.append(f"URL parsing error: {str(e)}")
    
    return suspicious


def check_fact_database(claim: str) -> Dict[str, Any]:
    """
    Query Google Fact Check Tools API for related fact checks.
    
    Requires GOOGLE_FACTCHECK_API_KEY to be set.
    """
    result = {
        "checked": False,
        "fact_checks": [],
        "verdict": None
    }
    
    if not GOOGLE_FACTCHECK_API_KEY:
        result["note"] = "Fact check API key not configured"
        return result
    
    try:
        url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
        params = {
            "key": GOOGLE_FACTCHECK_API_KEY,
            "query": claim[:500],  # Limit query length
            "languageCode": "en"
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            result["checked"] = True
            
            if "claims" in data:
                for claim_data in data["claims"][:3]:
                    for review in claim_data.get("claimReview", []):
                        result["fact_checks"].append({
                            "publisher": review.get("publisher", {}).get("name"),
                            "url": review.get("url"),
                            "rating": review.get("textualRating"),
                            "title": review.get("title")
                        })
                
                if result["fact_checks"]:
                    result["verdict"] = result["fact_checks"][0].get("rating")
                    
    except Exception as e:
        result["error"] = str(e)
    
    return result


def calculate_source_score(
    domain: str,
    domain_age: Optional[int],
    ssl_result: Dict,
    suspicious_patterns: List[str]
) -> int:
    """Calculate source credibility score (0-100)."""
    score = 50  # Base score
    
    # Reputable domain bonus
    if any(rep in domain for rep in REPUTABLE_DOMAINS):
        score += 30
    
    # Domain age
    if domain_age is not None:
        if domain_age < 30:
            score -= 25  # Very new domain
        elif domain_age < 180:
            score -= 10  # Less than 6 months
        elif domain_age > 730:  # More than 2 years
            score += 15
        elif domain_age > 365:
            score += 10
    
    # SSL
    if ssl_result.get("ssl_valid"):
        score += 10
    elif ssl_result.get("has_ssl"):
        score += 5  # Has SSL but invalid
    else:
        score -= 10  # No SSL
    
    # Suspicious patterns
    score -= len(suspicious_patterns) * 10
    
    return max(0, min(100, score))


def check_source(url: Optional[str] = None, claim: Optional[str] = None) -> SourceResult:
    """
    Main function to check source credibility.
    
    Args:
        url: URL source of the content
        claim: Text claim to check against fact-check databases
        
    Returns:
        SourceResult with credibility information
    """
    result = SourceResult()
    
    if not url and not claim:
        result.explanation = "No source URL or claim provided"
        return result
    
    explanations = []
    
    # URL/Domain analysis
    if url:
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # Remove www prefix
            if domain.startswith("www."):
                domain = domain[4:]
            
            result.domain = domain
            
            # Check domain age
            domain_age = check_domain_age(domain)
            result.domain_age_days = domain_age
            if domain_age is not None:
                if domain_age < 30:
                    explanations.append(f"Domain is only {domain_age} days old")
                elif domain_age > 365:
                    explanations.append(f"Established domain ({domain_age // 365}+ years)")
            
            # Check SSL
            ssl_result = check_ssl_certificate(domain)
            result.has_ssl = ssl_result.get("ssl_valid", False)
            if not result.has_ssl:
                explanations.append("No valid SSL certificate")
            
            # Check suspicious patterns
            suspicious = detect_suspicious_patterns(url)
            result.suspicious_patterns = suspicious
            if suspicious:
                explanations.append(f"Suspicious patterns: {', '.join(suspicious[:3])}")
            
            # Calculate score
            result.credibility_score = calculate_source_score(
                domain, domain_age, ssl_result, suspicious
            )
            
        except Exception as e:
            result.suspicious_patterns.append(f"URL analysis error: {str(e)}")
    
    # Fact check database
    if claim:
        fact_result = check_fact_database(claim)
        result.fact_checks_found = fact_result.get("fact_checks", [])
        if fact_result.get("verdict"):
            explanations.append(f"Fact check: {fact_result['verdict']}")
    
    result.explanation = "; ".join(explanations) if explanations else "Source analysis complete"
    
    return result
