'use client';

import React from 'react';
import Image from 'next/image';
import bg from '/public/bg/bg.webp';
import RenderModels from './RenderModels';
import Robot from './models/Robot';
import Portfolio3D from './Portfolio3D';
import Corsorfy from './Corsorfy';

export default function HomeScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between relative">
      <div className="absolute inset-0 overflow-hidden fixed">
        <Image
          src={bg}
          alt="Decorative portfolio background"
          priority
          sizes="100vw"
          className="w-full h-full object-cover object-center opacity-25 overflow-hidden fixed"
        />
      </div>

      <div className="mt-0 fixed">
        <h1 className="font-grechen text-2xl justify-center text-blue-800 items-center">
          HELLO WELLCOME MY PORTFOLIO
        </h1>
      </div>

      <div className="w-full h-screen bottom-0 fixed">
        <RenderModels>
          <Robot />
        </RenderModels>
      </div>

      <Portfolio3D />
      <Corsorfy />
    </main>
  );
}
