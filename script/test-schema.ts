import { users } from '../models/users';
import { chats } from '../models/chats';
import { messages } from '../models/messages';

console.log('Verifying Drizzle Schemas...');

try {
    console.log('Users Table:', users[Symbol.for('drizzle:Name')]);
    console.log('Chats Table:', chats[Symbol.for('drizzle:Name')]);
    console.log('Messages Table:', messages[Symbol.for('drizzle:Name')]);
    console.log('All schemas imported successfully.');
} catch (error) {
    console.error('Error verifying schemas:', error);
    process.exit(1);
}
