import { readFileSync, existsSync } from 'fs';
import { WebClient } from '@slack/web-api';

// Try to read env file
let envContent = '';
const envFiles = ['.env.local', '.env', '.env.development.local', '.env.development'];
for (const file of envFiles) {
  if (existsSync(file)) {
    envContent = readFileSync(file, 'utf-8');
    console.log(`Using env file: ${file}\n`);
    break;
  }
}

const getEnv = (key) => {
  if (process.env[key]) return process.env[key];
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const slackToken = getEnv('SLACK_BOT_TOKEN');

if (!slackToken) {
  console.error('Error: SLACK_BOT_TOKEN not found in env files.');
  console.log('Checked files:', envFiles.join(', '));
  process.exit(1);
}

console.log('Slack token found:', slackToken.substring(0, 10) + '...');

const client = new WebClient(slackToken);

const slackUserId = process.argv[2] || 'UQKSYEPM4';

async function testSlack() {
  console.log(`\nTesting Slack message to user: ${slackUserId}\n`);

  try {
    // First, test auth
    console.log('1. Testing auth...');
    const authResult = await client.auth.test();
    console.log('   Auth OK:', authResult.ok);
    console.log('   Bot user:', authResult.user);
    console.log('   Team:', authResult.team);

    // Try to get user info
    console.log('\n2. Getting user info...');
    try {
      const userInfo = await client.users.info({ user: slackUserId });
      console.log('   User found:', userInfo.user?.real_name || userInfo.user?.name);
      console.log('   User email:', userInfo.user?.profile?.email);
    } catch (e) {
      console.log('   Could not get user info:', e.message);
    }

    // Try to send a message
    console.log('\n3. Sending test message...');
    const result = await client.chat.postMessage({
      channel: slackUserId,
      text: 'Test message from LivePlay broadcast system',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Test Broadcast',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test message from the LivePlay broadcast system.',
          },
        },
      ],
    });

    console.log('   Message sent!');
    console.log('   Channel:', result.channel);
    console.log('   Timestamp:', result.ts);

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
  }
}

testSlack();
