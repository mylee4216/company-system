'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러를 콘솔에 기록
    console.error('Print page error:', error);
  }, [error]);

  return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
      <h2>페이지 로드 중 오류가 발생했습니다</h2>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button
        onClick={() => reset()}
        style={{
          padding: '10px 20px',
          marginTop: '10px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        다시 시도
      </button>
      <details style={{ marginTop: '20px', textAlign: 'left' }}>
        <summary>기술적 세부 정보 (개발자용)</summary>
        <pre style={{ fontSize: '12px', marginTop: '10px', whiteSpace: 'pre-wrap' }}>
          {error.message}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      </details>
    </div>
  );
}