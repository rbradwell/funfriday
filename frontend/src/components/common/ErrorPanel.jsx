import React from 'react';

function ErrorPanel({ error }) {
  return (
    <div style={{ color: "red", padding: "10px", border: "1px solid red" }}>
      <h3>Error</h3>
      <p>{error}</p>
    </div>
  );
}

export default ErrorPanel; 