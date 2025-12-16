import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const languages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Marathi'];

const visitReasons = [
  'Regular maintenance/service',
  'Oil change',
  'Tire rotation/replacement',
  'Brake service',
  'Engine problem',
  'Transmission issue',
  'Electrical problem',
  'Air conditioning service',
  'Body work/paint',
  'Accident repair',
  'Warranty service',
  'Recall service',
];

const returnReasons = [
  'Service not completed properly',
  'Problem persists',
  'Additional issues found',
  'Parts not available',
  'Wrong diagnosis',
  'Poor workmanship',
];

const comments = {
  5: [
    'Excellent service! Very satisfied with the attention to detail.',
    'Outstanding experience. The staff was very professional and friendly.',
    'Best service I have ever received. Highly recommend!',
    'Quick and efficient service. Very happy with the results.',
    'The team went above and beyond. Thank you!',
    'Perfect service! My car runs like new.',
    'Great job! Very impressed with the quality of work.',
    'Exceptional customer service and technical expertise.',
  ],
  4: [
    'Good service overall. Just a minor delay in completion.',
    'Satisfied with the work. Could improve on communication.',
    'Service was good, but the waiting area needs improvement.',
    'Happy with the results. Pricing was reasonable.',
    'Good experience, though had to wait a bit longer than expected.',
    'Quality work but could be faster.',
    'Overall good, minor room for improvement.',
  ],
  3: [
    'Service was okay. Nothing exceptional.',
    'Average experience. Expected better.',
    'Satisfactory but not impressive.',
    'It was fine, but I have had better experiences elsewhere.',
    'Decent service, but room for improvement.',
    'Met expectations but nothing more.',
  ],
  2: [
    'Not very satisfied. The service took too long.',
    'Disappointed with the quality of work.',
    'Had to return for the same issue. Not happy.',
    'Poor communication from the service team.',
    'Expected better service for the price paid.',
    'The problem was not fixed properly.',
  ],
  1: [
    'Very disappointed. Had to come back multiple times.',
    'Terrible experience. Would not recommend.',
    'Worst service ever. The issue is still not resolved.',
    'Extremely dissatisfied with the service quality.',
    'Very poor service. Staff was unprofessional.',
  ],
};

const emotionAnalysis = {
  5: {
    primary_emotion: 'very_satisfied' as const,
    emotion_confidence: 0.9,
    key_sentiments: [
      { aspect: 'service_quality', sentiment: 'positive' as const, intensity: 0.95 },
      { aspect: 'staff_behavior', sentiment: 'positive' as const, intensity: 0.9 },
      { aspect: 'timeliness', sentiment: 'positive' as const, intensity: 0.85 },
    ],
    tone: 'appreciative' as const,
    summary: 'Customer is extremely satisfied with exceptional service experience',
  },
  4: {
    primary_emotion: 'satisfied' as const,
    emotion_confidence: 0.8,
    key_sentiments: [
      { aspect: 'service_quality', sentiment: 'positive' as const, intensity: 0.8 },
      { aspect: 'staff_behavior', sentiment: 'positive' as const, intensity: 0.75 },
      { aspect: 'timeliness', sentiment: 'neutral' as const, intensity: 0.5 },
    ],
    tone: 'professional' as const,
    summary: 'Customer is generally satisfied with minor areas for improvement',
  },
  3: {
    primary_emotion: 'neutral' as const,
    emotion_confidence: 0.7,
    key_sentiments: [
      { aspect: 'service_quality', sentiment: 'neutral' as const, intensity: 0.5 },
      { aspect: 'staff_behavior', sentiment: 'neutral' as const, intensity: 0.6 },
      { aspect: 'timeliness', sentiment: 'neutral' as const, intensity: 0.5 },
    ],
    tone: 'casual' as const,
    summary: 'Customer has mixed feelings with average service experience',
  },
  2: {
    primary_emotion: 'dissatisfied' as const,
    emotion_confidence: 0.85,
    key_sentiments: [
      { aspect: 'service_quality', sentiment: 'negative' as const, intensity: 0.7 },
      { aspect: 'staff_behavior', sentiment: 'negative' as const, intensity: 0.6 },
      { aspect: 'timeliness', sentiment: 'negative' as const, intensity: 0.8 },
    ],
    tone: 'concerned' as const,
    summary: 'Customer is dissatisfied with service quality and experience',
  },
  1: {
    primary_emotion: 'very_dissatisfied' as const,
    emotion_confidence: 0.95,
    key_sentiments: [
      { aspect: 'service_quality', sentiment: 'negative' as const, intensity: 0.95 },
      { aspect: 'staff_behavior', sentiment: 'negative' as const, intensity: 0.85 },
      { aspect: 'timeliness', sentiment: 'negative' as const, intensity: 0.9 },
    ],
    tone: 'frustrated' as const,
    summary: 'Customer is extremely dissatisfied with poor service experience',
  },
};

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getWeightedRating(): number {
  // Weight towards higher ratings (more realistic)
  const rand = Math.random();
  if (rand < 0.35) return 5; // 35% - 5 stars
  if (rand < 0.60) return 4; // 25% - 4 stars
  if (rand < 0.80) return 3; // 20% - 3 stars
  if (rand < 0.92) return 2; // 12% - 2 stars
  return 1; // 8% - 1 star
}

function getRandomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return date;
}

function calculateSentimentScore(
  rating: number,
  firstTimeCompletion: boolean,
  emotion: typeof emotionAnalysis[keyof typeof emotionAnalysis]
): number {
  let score = rating / 5; // Base score from rating
  if (!firstTimeCompletion) score -= 0.2;

  const emotionAdjustment = {
    very_satisfied: 0.1,
    satisfied: 0.05,
    neutral: 0,
    dissatisfied: -0.1,
    very_dissatisfied: -0.2,
  };

  score += emotionAdjustment[emotion.primary_emotion] || 0;
  return Math.max(0, Math.min(1, score));
}

async function main() {
  console.log('Starting survey response seeding...');

  // Get all customers
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      customerName: true,
      email: true,
      phone: true,
      vehicleNumber: true,
    },
  });

  console.log(`Found ${customers.length} customers`);

  if (customers.length === 0) {
    console.log('No customers found. Please run the main seed script first.');
    return;
  }

  // Delete existing survey responses
  await prisma.surveyResponse.deleteMany({});
  console.log('Cleared existing survey responses');

  const surveyResponses = [];

  // Create 60-80 survey responses (some customers may have multiple responses)
  const responseCount = 60 + Math.floor(Math.random() * 21);

  for (let i = 0; i < responseCount; i++) {
    const customer = getRandomElement(customers);
    const rating = getWeightedRating();
    const firstTimeCompletion = Math.random() > 0.25; // 75% first time completion rate
    const contactAgreement = Math.random() > 0.3; // 70% contact agreement rate
    const preferredLanguage = getRandomElement(languages);

    // Visit reasons - 1 to 3 reasons
    const visitReasonCount = 1 + Math.floor(Math.random() * 3);
    const selectedVisitReasons = getRandomElements(visitReasons, visitReasonCount);

    // Return reasons only if not completed first time
    const selectedReturnReasons = !firstTimeCompletion
      ? getRandomElements(returnReasons, 1 + Math.floor(Math.random() * 2))
      : undefined;

    // Get comment based on rating
    const comment = Math.random() > 0.2 // 80% leave comments
      ? getRandomElement(comments[rating as keyof typeof comments])
      : undefined;

    // Get emotion analysis based on rating
    const emotion = emotionAnalysis[rating as keyof typeof emotionAnalysis];
    const sentimentScore = calculateSentimentScore(rating, firstTimeCompletion, emotion);

    // Generate realistic wait time and communication ratings
    // Wait time and communication tend to correlate with overall rating but with some variance
    const waitTimeRating = Math.max(1, Math.min(5, rating + Math.floor(Math.random() * 3) - 1));
    const communicationRating = Math.max(1, Math.min(5, rating + Math.floor(Math.random() * 3) - 1));

    // NPS Score correlates with rating:
    // 5 stars -> 9-10 (Promoters)
    // 4 stars -> 7-9 (Passives/Promoters)
    // 3 stars -> 5-7 (Passives)
    // 2 stars -> 3-5 (Detractors/Passives)
    // 1 star -> 0-3 (Detractors)
    let npsScore: number;
    if (rating === 5) npsScore = 9 + Math.floor(Math.random() * 2); // 9-10
    else if (rating === 4) npsScore = 7 + Math.floor(Math.random() * 3); // 7-9
    else if (rating === 3) npsScore = 5 + Math.floor(Math.random() * 3); // 5-7
    else if (rating === 2) npsScore = 3 + Math.floor(Math.random() * 3); // 3-5
    else npsScore = Math.floor(Math.random() * 4); // 0-3

    // Random submission date within last 30 days
    const submittedAt = getRandomDate(30);

    surveyResponses.push({
      customerId: customer.id,
      preferredLanguage,
      visitReasons: selectedVisitReasons,
      rating,
      comments: comment,
      waitTimeRating,
      communicationRating,
      npsScore,
      firstTimeCompletion,
      returnReasons: selectedReturnReasons,
      contactAgreement,
      customerName: contactAgreement ? customer.customerName : undefined,
      customerEmail: contactAgreement ? customer.email : undefined,
      customerPhone: contactAgreement ? customer.phone : undefined,
      vehicleNumber: customer.vehicleNumber,
      sentimentScore,
      emotionAnalysis: emotion,
      submittedAt,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
    });
  }

  // Sort by submission date
  surveyResponses.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  // Insert all survey responses
  for (const response of surveyResponses) {
    await prisma.surveyResponse.create({
      data: response,
    });
  }

  console.log(`✅ Created ${surveyResponses.length} survey responses`);

  // Print statistics
  const ratingCounts = [0, 0, 0, 0, 0];
  surveyResponses.forEach(r => ratingCounts[r.rating - 1]++);

  console.log('\n📊 Rating Distribution:');
  console.log(`⭐️ 5 stars: ${ratingCounts[4]} (${((ratingCounts[4]/surveyResponses.length)*100).toFixed(1)}%)`);
  console.log(`⭐️ 4 stars: ${ratingCounts[3]} (${((ratingCounts[3]/surveyResponses.length)*100).toFixed(1)}%)`);
  console.log(`⭐️ 3 stars: ${ratingCounts[2]} (${((ratingCounts[2]/surveyResponses.length)*100).toFixed(1)}%)`);
  console.log(`⭐️ 2 stars: ${ratingCounts[1]} (${((ratingCounts[1]/surveyResponses.length)*100).toFixed(1)}%)`);
  console.log(`⭐️ 1 star:  ${ratingCounts[0]} (${((ratingCounts[0]/surveyResponses.length)*100).toFixed(1)}%)`);

  const avgRating = surveyResponses.reduce((sum, r) => sum + r.rating, 0) / surveyResponses.length;
  console.log(`\n📈 Average Rating: ${avgRating.toFixed(2)}/5.00`);

  const firstTimeCount = surveyResponses.filter(r => r.firstTimeCompletion).length;
  console.log(`✅ First Time Completion: ${firstTimeCount}/${surveyResponses.length} (${((firstTimeCount/surveyResponses.length)*100).toFixed(1)}%)`);

  const contactCount = surveyResponses.filter(r => r.contactAgreement).length;
  console.log(`📞 Contact Agreement: ${contactCount}/${surveyResponses.length} (${((contactCount/surveyResponses.length)*100).toFixed(1)}%)`);

  console.log('\n✨ Survey seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding survey responses:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
