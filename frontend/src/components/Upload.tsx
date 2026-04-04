import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, Video, FileText, Music } from 'lucide-react';

interface UploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'],
  'video/*': ['.mp4', '.mov', '.avi', '.webm'],
  'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
  'application/pdf': ['.pdf'],
};

export function UploadZone({ onFileSelect, isLoading }: UploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-all duration-200 ease-in-out
        ${isDragActive 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      
      <div className="flex justify-center mb-4">
        <div className="flex gap-2">
          <Image className="w-8 h-8 text-gray-400" />
          <Video className="w-8 h-8 text-gray-400" />
          <Music className="w-8 h-8 text-gray-400" />
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
      </div>
      
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      
      {isDragActive ? (
        <p className="text-lg text-blue-600 font-medium">Drop the file here...</p>
      ) : (
        <>
          <p className="text-lg text-gray-700 font-medium mb-2">
            Drag & drop a file here, or click to select
          </p>
          <p className="text-sm text-gray-500">
            Supports images, videos, audio, and documents
          </p>
        </>
      )}
    </div>
  );
}
