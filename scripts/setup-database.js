#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function setupDatabase() {
  console.log('🗄️ Setting up MongoDB database...');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/business-automation';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    
    // Create collections
    const collections = [
      'users',
      'workflows', 
      'tasks',
      'executions',
      'integrations',
      'analytics'
    ];

    for (const collection of collections) {
      try {
        await db.createCollection(collection);
        console.log(`✅ Created collection: ${collection}`);
      } catch (error) {
        if (error.code === 48) {
          console.log(`ℹ️ Collection ${collection} already exists`);
        } else {
          throw error;
        }
      }
    }

    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('workflows').createIndex({ userId: 1, status: 1 });
    await db.collection('tasks').createIndex({ status: 1, createdAt: -1 });
    await db.collection('executions').createIndex({ workflowId: 1, startTime: -1 });

    console.log('✅ Database setup completed');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };