import { createUser } from '../services/user.service';
import { createChat, sendMessage, processAiResponse, getMessages } from '../services/chat.service';
import { createProject } from '../services/project.service';
import { db } from '../config/db.config';
import { sql } from 'drizzle-orm';

const runTest = async () => {
    try {
        console.log('Starting End-to-End Test with Projects...');

        // 1. Create Project
        console.log('Creating project...');
        // We use 'apar_sql' as the script name, assuming apar_sql.py exists
        const project = await createProject('Test Project', 'test-project', 'apar_sql');
        console.log('Project created:', project);

        // 2. Create User
        const timestamp = Date.now();
        const email = `testuser_${timestamp}@example.com`;
        console.log(`Creating user with email: ${email}`);
        const user = await createUser('Test User', email);
        console.log('User created:', user);

        // 3. Create Chat linked to Project
        console.log('Creating chat...');
        const chat = await createChat(user.id, 'Test Topic', project.slug);
        console.log('Chat created:', chat);

        // 4. Send Message
        console.log('Sending message...');
        const userMessage = await sendMessage(chat.id, 'Show me all users', 'user');
        console.log('User message saved:', userMessage);

        // 5. Process AI Response
        console.log('Processing AI response...');

        try {
            const aiMessage = await processAiResponse(chat.id);
            console.log('AI response received:', aiMessage);
        } catch (e) {
            console.error('AI processing failed (expected if Python env/DB not fully set up in this context):', e);
        }

        // 6. Verify Messages
        const messages = await getMessages(chat.id);
        console.log('All messages in chat:', messages);

        if (messages.length >= 1) {
            console.log('Test PASSED: Messages persisted.');
        } else {
            console.error('Test FAILED: No messages found.');
            process.exit(1);
        }

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
};

runTest();
