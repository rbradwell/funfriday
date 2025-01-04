import React from 'react';
import ScoreList from './ScoreList';

function FinalScores({ scores }) {
  return (
    <main>
      <section className="container">
        <h3>Game Over! Scores:</h3>
        <ScoreList scores={scores} />
        <p>Redirecting to the lobby in 5 seconds...</p>
      </section>
    </main>
  );
}

export default FinalScores; 