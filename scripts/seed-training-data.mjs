import { readFileSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

// Setup DynamoDB
const client = new DynamoDBClient({
  region: 'us-west-2',
  credentials: {
    accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
  },
});
const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  COURSES: 'liveplayhosts-courses',
  SECTIONS: 'liveplayhosts-sections',
  LESSONS: 'liveplayhosts-lessons',
};

const now = new Date().toISOString();

// Sample courses
const courses = [
  {
    id: 'course-onboarding-101',
    title: 'Host Onboarding',
    description: 'Everything you need to know to get started as a LivePlay host. Learn the basics of live streaming, our platform, and best practices.',
    category: 'onboarding',
    isRequired: true,
    isSequential: true,
    requiredRoles: [],
    estimatedDuration: 45,
    order: 1,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'course-engagement-mastery',
    title: 'Audience Engagement Mastery',
    description: 'Learn advanced techniques to captivate your audience, increase viewer retention, and create memorable live experiences.',
    category: 'skills',
    isRequired: false,
    isSequential: false,
    requiredRoles: [],
    estimatedDuration: 60,
    order: 2,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'course-compliance-basics',
    title: 'Compliance & Guidelines',
    description: 'Understand the rules, regulations, and best practices for compliant hosting. Required for all active hosts.',
    category: 'compliance',
    isRequired: true,
    isSequential: true,
    requiredRoles: [],
    estimatedDuration: 30,
    order: 3,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  },
];

// Sample sections
const sections = [
  // Onboarding course sections
  {
    id: 'section-onboarding-welcome',
    courseId: 'course-onboarding-101',
    title: 'Welcome to LivePlay',
    description: 'Get introduced to the LivePlay platform and team',
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'section-onboarding-setup',
    courseId: 'course-onboarding-101',
    title: 'Setting Up Your Studio',
    description: 'Technical setup and equipment recommendations',
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'section-onboarding-first-show',
    courseId: 'course-onboarding-101',
    title: 'Your First Show',
    description: 'Step-by-step guide to hosting your first live session',
    order: 3,
    createdAt: now,
    updatedAt: now,
  },
  // Engagement course sections
  {
    id: 'section-engagement-basics',
    courseId: 'course-engagement-mastery',
    title: 'Engagement Fundamentals',
    description: 'Core principles of audience engagement',
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'section-engagement-advanced',
    courseId: 'course-engagement-mastery',
    title: 'Advanced Techniques',
    description: 'Take your engagement to the next level',
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  // Compliance course sections
  {
    id: 'section-compliance-rules',
    courseId: 'course-compliance-basics',
    title: 'Platform Rules',
    description: 'Essential rules every host must follow',
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'section-compliance-legal',
    courseId: 'course-compliance-basics',
    title: 'Legal Guidelines',
    description: 'Legal requirements and disclosures',
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
];

// Sample lessons
const lessons = [
  // Onboarding - Welcome section
  {
    id: 'lesson-welcome-intro',
    sectionId: 'section-onboarding-welcome',
    courseId: 'course-onboarding-101',
    title: 'Welcome to the Team!',
    type: 'video',
    content: '',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    estimatedDuration: 5,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-welcome-platform',
    sectionId: 'section-onboarding-welcome',
    courseId: 'course-onboarding-101',
    title: 'Platform Overview',
    type: 'article',
    content: `
      <h2>Welcome to LivePlay</h2>
      <p>LivePlay is a cutting-edge live shopping platform that connects hosts with engaged audiences. As a host, you'll have the opportunity to showcase products, interact with viewers in real-time, and build your personal brand.</p>

      <h3>What Makes LivePlay Different</h3>
      <ul>
        <li><strong>Real-time Interaction</strong> - Chat with your audience, answer questions, and create a personalized shopping experience</li>
        <li><strong>Professional Support</strong> - Our production team is always available to help you succeed</li>
        <li><strong>Growth Opportunities</strong> - Build your following and advance your hosting career</li>
      </ul>

      <h3>Your Role as a Host</h3>
      <p>As a LivePlay host, you are the face of the products you showcase. Your energy, knowledge, and authenticity are what make the shopping experience special for our viewers.</p>

      <blockquote>
        "The best hosts are those who genuinely connect with their audience and have fun while doing it!"
      </blockquote>

      <h3>What's Next</h3>
      <p>Continue through this onboarding course to learn everything you need to know about:</p>
      <ol>
        <li>Setting up your streaming equipment</li>
        <li>Understanding the platform features</li>
        <li>Preparing for your first show</li>
        <li>Engaging with your audience</li>
      </ol>
    `,
    estimatedDuration: 8,
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  // Onboarding - Setup section
  {
    id: 'lesson-setup-equipment',
    sectionId: 'section-onboarding-setup',
    courseId: 'course-onboarding-101',
    title: 'Equipment Essentials',
    type: 'article',
    content: `
      <h2>Setting Up Your Home Studio</h2>
      <p>You don't need expensive equipment to get started, but having the right basics makes a big difference in your stream quality.</p>

      <h3>Essential Equipment</h3>

      <h4>Camera</h4>
      <p>Your smartphone camera is a great starting point! Most modern phones have excellent video quality. If you want to upgrade:</p>
      <ul>
        <li>Webcam: Logitech C920 or C922 ($70-100)</li>
        <li>DSLR/Mirrorless: Any camera with clean HDMI output</li>
      </ul>

      <h4>Lighting</h4>
      <p>Good lighting is more important than an expensive camera!</p>
      <ul>
        <li><strong>Ring Light</strong> - Great for even, flattering light on your face</li>
        <li><strong>Softbox Kit</strong> - Professional look with minimal shadows</li>
        <li><strong>Natural Light</strong> - Position yourself facing a window</li>
      </ul>

      <h4>Audio</h4>
      <p>Clear audio is crucial for engagement:</p>
      <ul>
        <li>Lapel mic ($20-50) - Clips to your shirt</li>
        <li>USB microphone ($50-150) - Desktop option</li>
        <li>Avoid relying on built-in laptop/phone mics</li>
      </ul>

      <h3>Background Setup</h3>
      <p>Keep your background clean and professional:</p>
      <ul>
        <li>Remove clutter and distractions</li>
        <li>Add some plants or decorations for personality</li>
        <li>Consider a branded backdrop</li>
      </ul>
    `,
    estimatedDuration: 10,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-setup-software',
    sectionId: 'section-onboarding-setup',
    courseId: 'course-onboarding-101',
    title: 'Software & App Setup',
    type: 'article',
    content: `
      <h2>Getting Your Software Ready</h2>

      <h3>The LivePlay Host App</h3>
      <p>Download the LivePlay Host app from the App Store or Google Play. This is your main tool for:</p>
      <ul>
        <li>Going live</li>
        <li>Managing your schedule</li>
        <li>Viewing analytics</li>
        <li>Communicating with your producer</li>
      </ul>

      <h3>App Setup Steps</h3>
      <ol>
        <li>Download and install the app</li>
        <li>Log in with your LivePlay credentials</li>
        <li>Complete your profile setup</li>
        <li>Test your camera and microphone</li>
        <li>Familiarize yourself with the interface</li>
      </ol>

      <h3>Testing Your Setup</h3>
      <p>Before your first show, always do a test stream:</p>
      <ul>
        <li>Check video quality and framing</li>
        <li>Test audio levels</li>
        <li>Verify your internet connection is stable</li>
        <li>Practice switching between products</li>
      </ul>

      <p><strong>Pro Tip:</strong> Schedule a tech check with your producer before your first live show!</p>
    `,
    estimatedDuration: 7,
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  // Onboarding - First Show section
  {
    id: 'lesson-first-show-prep',
    sectionId: 'section-onboarding-first-show',
    courseId: 'course-onboarding-101',
    title: 'Pre-Show Preparation',
    type: 'article',
    content: `
      <h2>Preparing for Your First Live Show</h2>

      <h3>The Day Before</h3>
      <ul>
        <li>Review the products you'll be showcasing</li>
        <li>Prepare talking points for each item</li>
        <li>Test all your equipment</li>
        <li>Get a good night's sleep!</li>
      </ul>

      <h3>Show Day Checklist</h3>
      <ol>
        <li>☐ Equipment tested and working</li>
        <li>☐ Products organized and within reach</li>
        <li>☐ Backup phone/device charged</li>
        <li>☐ Water bottle nearby</li>
        <li>☐ Notifications silenced</li>
        <li>☐ "Do Not Disturb" sign on door</li>
      </ol>

      <h3>Mental Preparation</h3>
      <p>It's normal to feel nervous before your first show! Here are some tips:</p>
      <ul>
        <li>Take deep breaths before going live</li>
        <li>Remember: viewers want you to succeed!</li>
        <li>Focus on being helpful, not perfect</li>
        <li>Smile - it comes through on camera</li>
      </ul>
    `,
    estimatedDuration: 8,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-first-show-live',
    sectionId: 'section-onboarding-first-show',
    courseId: 'course-onboarding-101',
    title: 'Going Live!',
    type: 'article',
    content: `
      <h2>Your First Live Stream</h2>

      <h3>The First 30 Seconds</h3>
      <p>Your opening sets the tone for the entire show:</p>
      <ul>
        <li>Smile and greet viewers warmly</li>
        <li>Introduce yourself briefly</li>
        <li>Preview what you'll be showing</li>
        <li>Encourage viewers to ask questions</li>
      </ul>

      <h3>During the Show</h3>
      <ul>
        <li><strong>Engage with chat</strong> - Call out viewer names and answer questions</li>
        <li><strong>Show enthusiasm</strong> - Your energy is contagious!</li>
        <li><strong>Demonstrate products</strong> - Show them in action, not just on display</li>
        <li><strong>Create urgency</strong> - Mention limited quantities or special deals</li>
      </ul>

      <h3>Handling Challenges</h3>
      <p>Things don't always go perfectly, and that's okay!</p>
      <ul>
        <li><strong>Tech issues:</strong> Acknowledge briefly, stay calm, your producer will help</li>
        <li><strong>Quiet chat:</strong> Ask questions to prompt engagement</li>
        <li><strong>Difficult questions:</strong> Be honest if you don't know - offer to find out</li>
      </ul>

      <h3>Closing Strong</h3>
      <ul>
        <li>Thank viewers for joining</li>
        <li>Recap featured products</li>
        <li>Remind them of any deals</li>
        <li>Tease your next show</li>
      </ul>

      <p><strong>You've got this! 🎉</strong></p>
    `,
    estimatedDuration: 7,
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  // Engagement course lessons
  {
    id: 'lesson-engagement-psychology',
    sectionId: 'section-engagement-basics',
    courseId: 'course-engagement-mastery',
    title: 'Psychology of Live Shopping',
    type: 'article',
    content: `
      <h2>Understanding Your Audience</h2>

      <h3>Why People Watch Live Shopping</h3>
      <ul>
        <li><strong>Entertainment</strong> - They want to be entertained and inspired</li>
        <li><strong>Connection</strong> - Live shopping feels personal and interactive</li>
        <li><strong>Discovery</strong> - Finding new products they didn't know they needed</li>
        <li><strong>Trust</strong> - Seeing products in action builds confidence</li>
      </ul>

      <h3>The Power of FOMO</h3>
      <p>Fear of Missing Out is a powerful motivator:</p>
      <ul>
        <li>Limited-time deals create urgency</li>
        <li>Exclusive live-only offers drive action</li>
        <li>Countdown timers increase excitement</li>
      </ul>

      <h3>Building Trust</h3>
      <p>Trust is the foundation of successful live selling:</p>
      <ul>
        <li>Be honest about product pros AND cons</li>
        <li>Share personal experiences</li>
        <li>Admit when something isn't right for someone</li>
        <li>Follow through on promises</li>
      </ul>
    `,
    estimatedDuration: 12,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-engagement-chat',
    sectionId: 'section-engagement-basics',
    courseId: 'course-engagement-mastery',
    title: 'Mastering Live Chat',
    type: 'article',
    content: `
      <h2>Chat Engagement Strategies</h2>

      <h3>Reading the Room</h3>
      <p>Pay attention to chat patterns:</p>
      <ul>
        <li>Lots of questions = high interest, slow down</li>
        <li>Quiet chat = prompt with questions</li>
        <li>Emojis flying = you're doing great!</li>
      </ul>

      <h3>Engagement Techniques</h3>
      <ul>
        <li><strong>Use names</strong> - "Great question, Sarah!"</li>
        <li><strong>Ask opinions</strong> - "Which color do you prefer?"</li>
        <li><strong>Create polls</strong> - "Type 1 for blue, 2 for red!"</li>
        <li><strong>Acknowledge lurkers</strong> - "Welcome to everyone just joining!"</li>
      </ul>

      <h3>Handling Different Viewer Types</h3>
      <ul>
        <li><strong>The Questioner</strong> - Answer thoroughly, they're close to buying</li>
        <li><strong>The Regular</strong> - Give them shoutouts, they're your ambassadors</li>
        <li><strong>The Skeptic</strong> - Win them over with honesty</li>
        <li><strong>The Silent Buyer</strong> - Keep engaging, they're watching!</li>
      </ul>
    `,
    estimatedDuration: 15,
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-engagement-storytelling',
    sectionId: 'section-engagement-advanced',
    courseId: 'course-engagement-mastery',
    title: 'Storytelling That Sells',
    type: 'article',
    content: `
      <h2>The Art of Product Storytelling</h2>

      <h3>Why Stories Work</h3>
      <p>People don't buy products, they buy stories and transformations:</p>
      <ul>
        <li>Stories create emotional connections</li>
        <li>They help viewers imagine owning the product</li>
        <li>Personal stories build authenticity</li>
      </ul>

      <h3>Story Framework</h3>
      <ol>
        <li><strong>The Problem</strong> - What challenge does this solve?</li>
        <li><strong>The Discovery</strong> - How did you find this product?</li>
        <li><strong>The Transformation</strong> - How did it change things?</li>
        <li><strong>The Invitation</strong> - How can they experience this too?</li>
      </ol>

      <h3>Example</h3>
      <blockquote>
        "I used to struggle with tangled necklaces every morning - so frustrating! Then I discovered this jewelry organizer, and now I can see everything at a glance. Getting ready is actually enjoyable now. Imagine opening your drawer and seeing all your jewelry perfectly organized..."
      </blockquote>
    `,
    estimatedDuration: 18,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  // Compliance course lessons
  {
    id: 'lesson-compliance-content',
    sectionId: 'section-compliance-rules',
    courseId: 'course-compliance-basics',
    title: 'Content Guidelines',
    type: 'article',
    content: `
      <h2>LivePlay Content Guidelines</h2>

      <h3>Prohibited Content</h3>
      <p>The following is never allowed on LivePlay:</p>
      <ul>
        <li>Misleading product claims</li>
        <li>Offensive or discriminatory language</li>
        <li>Unauthorized use of copyrighted material</li>
        <li>Discussion of competitors during shows</li>
        <li>Personal contact information sharing</li>
      </ul>

      <h3>Required Disclosures</h3>
      <p>You must always disclose:</p>
      <ul>
        <li>That you are a paid host</li>
        <li>Any personal relationship with brands</li>
        <li>When showing gifted products</li>
      </ul>

      <h3>Product Claims</h3>
      <ul>
        <li>Only make claims you can verify</li>
        <li>Don't promise specific results</li>
        <li>Be careful with health-related statements</li>
        <li>When in doubt, describe your personal experience</li>
      </ul>
    `,
    estimatedDuration: 10,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-compliance-safety',
    sectionId: 'section-compliance-rules',
    courseId: 'course-compliance-basics',
    title: 'Safety & Privacy',
    type: 'article',
    content: `
      <h2>Keeping Yourself and Viewers Safe</h2>

      <h3>Personal Safety</h3>
      <ul>
        <li>Never share your home address</li>
        <li>Be careful about revealing personal details</li>
        <li>Keep work and personal social media separate</li>
        <li>Report any harassment immediately</li>
      </ul>

      <h3>Viewer Privacy</h3>
      <ul>
        <li>Don't read out full names without permission</li>
        <li>Never share viewer purchase details publicly</li>
        <li>Be mindful when showing chat on screen</li>
      </ul>

      <h3>Reporting Issues</h3>
      <p>If you encounter any of the following, report immediately:</p>
      <ul>
        <li>Threats or harassment</li>
        <li>Inappropriate viewer behavior</li>
        <li>Technical security concerns</li>
        <li>Suspected fraud attempts</li>
      </ul>
      <p>Contact your producer or email safety@liveplay.com</p>
    `,
    estimatedDuration: 8,
    order: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lesson-compliance-ftc',
    sectionId: 'section-compliance-legal',
    courseId: 'course-compliance-basics',
    title: 'FTC Guidelines',
    type: 'article',
    content: `
      <h2>FTC Compliance for Live Sellers</h2>

      <h3>What is the FTC?</h3>
      <p>The Federal Trade Commission regulates advertising and endorsements. As a host, you must follow their guidelines.</p>

      <h3>Key Requirements</h3>

      <h4>Clear Disclosure</h4>
      <p>Viewers must understand your relationship with the brand:</p>
      <ul>
        <li>Disclose at the beginning of each show</li>
        <li>Use clear language: "I'm a paid host for LivePlay"</li>
        <li>Don't bury disclosures in small text</li>
      </ul>

      <h4>Honest Reviews</h4>
      <ul>
        <li>Only endorse products you've actually used</li>
        <li>Share genuine opinions</li>
        <li>Don't exaggerate benefits</li>
      </ul>

      <h4>Testimonials</h4>
      <ul>
        <li>Results should be typical, not exceptional</li>
        <li>If showing before/after, they must be real</li>
        <li>Don't promise specific outcomes</li>
      </ul>

      <h3>Penalties</h3>
      <p>FTC violations can result in significant fines. When in doubt, disclose!</p>
    `,
    estimatedDuration: 12,
    order: 1,
    createdAt: now,
    updatedAt: now,
  },
];

async function seedData() {
  console.log('Seeding training data...\n');

  // Seed courses
  console.log('Creating courses...');
  for (const course of courses) {
    await dynamoDb.send(new PutCommand({ TableName: TABLES.COURSES, Item: course }));
    console.log(`  ✓ ${course.title}`);
  }

  // Seed sections
  console.log('\nCreating sections...');
  for (const section of sections) {
    await dynamoDb.send(new PutCommand({ TableName: TABLES.SECTIONS, Item: section }));
    console.log(`  ✓ ${section.title}`);
  }

  // Seed lessons
  console.log('\nCreating lessons...');
  for (const lesson of lessons) {
    await dynamoDb.send(new PutCommand({ TableName: TABLES.LESSONS, Item: lesson }));
    console.log(`  ✓ ${lesson.title}`);
  }

  console.log('\n✅ Seed data complete!');
  console.log(`   ${courses.length} courses`);
  console.log(`   ${sections.length} sections`);
  console.log(`   ${lessons.length} lessons`);
}

seedData().catch(console.error);
