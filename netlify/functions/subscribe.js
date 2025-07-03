// netlify/functions/subscribe.js - Serverless function for email subscription

const mongoose = require('mongoose');

// Use a global variable to cache the database connection across invocations
// This is crucial for performance in serverless environments to avoid cold starts
let cachedDb = null;

// MongoDB Schema and Model
const emailSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true, // Ensures no duplicate emails are stored
        trim: true, // Removes whitespace from email string
        lowercase: true, // Stores emails in lowercase for consistency
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // Basic email format validation
    },
    subscribedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

// Create the model, or use existing one to prevent Mongoose overwrite error in hot reloads
const Email = mongoose.models.Email || mongoose.model('Email', emailSchema);

/**
 * Connects to the MongoDB database, reusing the connection if available.
 * @returns {Promise<mongoose.Connection>} The Mongoose connection object.
 */
async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb; // Reuse existing connection
    }

    // Connect to our MongoDB database
    // MONGODB_URI is stored as an environment variable in Netlify
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
        bufferCommands: false, // Disable Mongoose buffering for serverless
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });

    cachedDb = connection;
    console.log('MongoDB connected successfully (new connection)');
    return cachedDb;
}

/**
 * Main handler for the Netlify Function.
 * @param {object} event - The event object from Netlify (contains HTTP method, body, etc.).
 * @param {object} context - The context object from Netlify.
 * @returns {object} The HTTP response object.
 */
exports.handler = async (event, context) => {
    // IMPORTANT: Keep the connection alive for subsequent calls in the same container.
    // This is a common pattern for serverless functions with databases.
    context.callbackWaitsForEmptyEventLoop = false;

    // Only allow POST requests for this endpoint
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ success: false, message: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    let email;
    try {
        // Parse the request body as JSON
        const body = JSON.parse(event.body);
        email = body.email;
    } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'Invalid request body.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // Server-side validation
    if (!email || email.trim() === '') {
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'Email address is required.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // Basic regex validation (matches schema's validation too)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'Please provide a valid email format.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        await connectToDatabase(); // Connect to DB (or reuse cached connection)

        // Attempt to create and save the new email
        const newEmail = new Email({ email });
        await newEmail.save();

        console.log(`Successfully subscribed email: ${email}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Thank you for signing up for early access!' }),
            headers: { 'Content-Type': 'application/json' }
        };
    } catch (error) {
        console.error('Error during subscription process:', error);

        // Handle specific MongoDB errors (e.g., duplicate key)
        if (error.code === 11000) { // MongoDB duplicate key error
            return {
                statusCode: 409, // Conflict
                body: JSON.stringify({ success: false, message: 'This email is already subscribed. Thank you!' }),
                headers: { 'Content-Type': 'application/json' }
            };
        } else if (error.name === 'ValidationError') { // Mongoose validation error
             return {
                statusCode: 400,
                body: JSON.stringify({ success: false, message: `Validation failed: ${error.message}` }),
                headers: { 'Content-Type': 'application/json' }
            };
        } else {
            // Generic server error
            return {
                statusCode: 500,
                body: JSON.stringify({ success: false, message: 'An unexpected server error occurred. Please try again later.' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }
    }
};