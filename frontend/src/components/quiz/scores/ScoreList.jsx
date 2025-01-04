import React from 'react';

function ScoreList({ scores }) {
  return (
      <ul>
        {Object.entries(scores).map(([userId, scoreData]) => (
          <li key={userId}>
            <p>User {userId}: {scoreData.total_score}</p>
            <ul>
              {Object.entries(scoreData.category_scores).map(([category, categoryScore]) => (
                <li key={category}>
                  {category} category : {categoryScore}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
  );
}

export default ScoreList; 