import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK using environment variable
const firebaseCreds = JSON.parse(process.env.FIREBASE_CREDENTIALS as string);
admin.initializeApp({
    credential: admin.credential.cert(firebaseCreds),
});

const db = admin.firestore();

/**
 * Create a new chat and return its document ID.
 * @returns {Promise<string>} The ID of the created chat document.
 */
export async function createChat(): Promise<string> {
    const collectionRef = db.collection('loopchats');
    const docRef = await collectionRef.add({
        time: Timestamp.now(),
    });
    return docRef.id;
}

/**
 * Push a message to a chat document.
 * @param {string} chatId - The ID of the chat.
 * @param {string} agent - The agent sending the message.
 * @param {string | null} message - The message content.
 */
export async function pushMessage(
    chatId: string,
    agent: string,
    message: string | null
): Promise<void> {
    const trimmedMessage = message?.trim();
    if (!trimmedMessage || ['TERMINATE', '', '!@#$^'].includes(trimmedMessage)) {
        return;
    }

    const collectionRef = db.collection(`loopchats/${chatId}/messages`);
    await collectionRef.add({
        chat_id: chatId,
        agent: agent,
        time: Timestamp.now(),
        userInput: false,
        ai: agent !== 'human_proxy',
        message: trimmedMessage,
    });
}

// Example Usage:
// createChat().then(chatId => {
//   pushMessage(chatId, 'ai_agent', 'Hello, how can I assist you today?');
// });
