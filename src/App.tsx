/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import VideoGenerator from './components/VideoGenerator';

export default function App() {
  return (
    <div className="min-h-screen w-full relative">
      <div className="atmosphere" />
      <div className="relative z-10 py-12 md:py-20 px-4">
        <VideoGenerator />
      </div>
    </div>
  );
}
