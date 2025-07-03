// script.js - Client-side form handling

'use strict'; // Enable strict mode for cleaner code

document.addEventListener('DOMContentLoaded', () => {
    // Get references to both email forms
    const heroForm = document.getElementById('hero-email-form');
    const footerForm = document.getElementById('footer-email-form');

    /**
     * Handles the form submission logic.
     * @param {Event} event - The form submission event.
     * @param {HTMLElement} formElement - The form HTML element that was submitted.
     */
    const handleSubmit = async (event, formElement) => {
        event.preventDefault(); // Prevent default form submission and page reload

        const emailInput = formElement.querySelector('input[type="email"]');
        const formMessage = formElement.querySelector('.form-message');
        const email = emailInput.value.trim(); // Trim whitespace from email input

        // Reset previous messages
        formMessage.textContent = '';
        formMessage.classList.remove('success', 'error');

        // Client-side validation
        if (!email) {
            formMessage.textContent = 'Please enter your email address.';
            formMessage.classList.add('error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            formMessage.textContent = 'Please enter a valid email address.';
            formMessage.classList.add('error');
            return;
        }

        formMessage.textContent = 'Submitting...';
        formMessage.classList.remove('error', 'success'); // Clear previous states

        try {
            // Send data to your Netlify Function
            // The path /.netlify/functions/subscribe corresponds to your subscribe.js function
            const response = await fetch('/.netlify/functions/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' // Request JSON response
                },
                body: JSON.stringify({ email: email }), // Send email as a JSON object
            });

            // Parse the JSON response from the serverless function
            const data = await response.json();

            // Check if the HTTP status code is in the 2xx range and the backend's 'success' flag is true
            if (response.ok && data.success) {
                formMessage.textContent = data.message;
                formMessage.classList.add('success');
                emailInput.value = ''; // Clear input on successful submission
            } else {
                // Handle non-2xx HTTP responses or backend-specific errors
                formMessage.textContent = data.message || 'Something went wrong. Please try again.';
                formMessage.classList.add('error');
            }
        } catch (error) {
            // Handle network errors (e.g., server unreachable) or unexpected errors
            console.error('Frontend Fetch Error:', error);
            formMessage.textContent = 'An unexpected error occurred. Please check your internet connection.';
            formMessage.classList.add('error');
        }
    };

    // Attach event listeners to the forms if they exist
    if (heroForm) {
        heroForm.addEventListener('submit', (event) => handleSubmit(event, heroForm));
    }

    if (footerForm) {
        footerForm.addEventListener('submit', (event) => handleSubmit(event, footerForm));
    }
});