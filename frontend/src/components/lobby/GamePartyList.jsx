import React from 'react';

function GamePartyList({ parties, handleJoinParty }) {
    return (
        <ul>
            {parties.map((party) => (
                <li key={party.party_id}>
                    <div>
                        <strong>ID:</strong> {party.party_id} <br />
                        <strong>Creator:</strong> {party.creator} <br />
                        <strong>Rounds:</strong> {party.rounds} <br />
                        <strong>Participants:</strong> {party.participants} <br />
                        <button onClick={() => handleJoinParty(party.party_id)}>Join Game</button>
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default GamePartyList; 