'use client';

import Image from 'next/image';
import { useState } from 'react';

interface DayImageGalleryProps {
  images?: string[];
  dayNumber?: number;
}

export default function DayImageGallery({ images, dayNumber }: DayImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <>
      {/* Image Gallery Grid */}
      <div className="mt-8 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((imagePath, idx) => (
            <div
              key={idx}
              className="relative h-40 md:h-48 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage(imagePath)}
            >
              <Image
                src={imagePath}
                alt={`Day ${dayNumber} - Image ${idx + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative w-full max-w-4xl max-h-[90vh]">
            <Image
              src={selectedImage}
              alt="Full size view"
              width={1200}
              height={800}
              className="w-full h-auto object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white rounded-full w-10 h-10 flex items-center justify-center text-black font-bold text-xl hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
