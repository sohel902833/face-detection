import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const videoConstraints = {
  width: 480,
  height: 360,
  facingMode: 'user',
};

export default function CameraCapture({ onCapture, label = 'Take Photo', disabled = false }) {
  const webcamRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [isLive, setIsLive] = useState(true);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCaptured(imageSrc);
      setIsLive(false);
      // Convert base64 to File
      fetch(imageSrc)
        .then(r => r.blob())
        .then(blob => {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          onCapture(file, imageSrc);
        });
    }
  }, [onCapture]);

  const retake = () => {
    setCaptured(null);
    setIsLive(true);
    onCapture(null, null);
  };

  return (
    <div className="camera-wrapper">
      <div className="camera-frame">
        {isLive ? (
          <>
            {cameraError ? (
              <div className="camera-error">
                <AlertCircle size={32} />
                <p>Camera access denied</p>
                <small>Please allow camera permissions</small>
              </div>
            ) : (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                onUserMediaError={() => setCameraError(true)}
                className="webcam-video"
                mirrored
              />
            )}
            <div className="camera-overlay">
              <div className="face-guide" />
            </div>
          </>
        ) : (
          <div className="captured-preview">
            <img src={captured} alt="Captured" />
            <div className="captured-badge">
              <CheckCircle size={16} />
              <span>Photo captured</span>
            </div>
          </div>
        )}
      </div>

      <div className="camera-actions">
        {isLive ? (
          <button
            type="button"
            className="btn-capture"
            onClick={capture}
            disabled={disabled || cameraError}
          >
            <Camera size={18} />
            {label}
          </button>
        ) : (
          <button
            type="button"
            className="btn-retake"
            onClick={retake}
            disabled={disabled}
          >
            <RefreshCw size={18} />
            Retake
          </button>
        )}
      </div>
    </div>
  );
}
