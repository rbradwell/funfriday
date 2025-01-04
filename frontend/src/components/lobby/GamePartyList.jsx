import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function GamePartyList({ parties }) {
    const navigate = useNavigate();

    const handleJoinParty = async (partyId) => {
        const playerId = localStorage.getItem('playerId');
        console.log('joining party', partyId);
        console.log('playerId', playerId);
        try {
            const response = await axios.post(`/api/party/${partyId}/join`, {
                user_id: playerId
            });
            navigate(`/quiz?party_id=${partyId}&user_id=${playerId}`);
        } catch (error) {
            alert('Error joining party: ' + error.message);
        }
    };

    if (parties.length === 0) {
        return (
            <>
                <h3>No games have been created yet...</h3>
                <button onClick={() => navigate('/create')}>Create a Game</button>
            </>
        );
    }
    return (
        <ul>
            {parties.map(party => (
                console.log('party in game party list here 2', party),
                <li key={party.party_id}>
                    <strong>ID:</strong> {party.party_id} <br />
                    <strong>Creator:</strong> {party.creator} <br />
                    <strong>Rounds:</strong> {party.rounds} <br />
                    <strong>Participants:</strong> {party.participants} <br />
                    <button onClick={() => handleJoinParty(party.party_id)}>Join</button>
                </li>
            ))}
        </ul>
    );
}

export default GamePartyList; 