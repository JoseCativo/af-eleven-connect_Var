import fs from 'fs/promises';
import path from 'path';

/**
 * Helper function to generate a customized prompt by reading from script.md
 * @param {Object} params - User parameters from request body
 * @param {string} params.full_name - User's full name
 * @param {string} params.business_name - Business name
 * @param {string} params.city - City location
 * @param {string} params.job_title - Job title
 * @param {string} params.email - Email address
 * @param {string} params.phone - Phone number
 * @returns {Promise<string>} - Customized prompt content
 */
async function getCustomizedPrompt(params = {}) {
  const {
    full_name = '',
    business_name = '',
    city = '',
    job_title = '',
    email = '',
    phone = ''
  } = params;

  try {
    // Read the script.md file
    const scriptPath = path.resolve(process.cwd(), 'prompts/script.md');
    const scriptContent = await fs.readFile(scriptPath, 'utf8');
    
    // Create a prompt by replacing placeholders in the script
    let prompt = scriptContent;
    
    // Replace placeholders with actual values if they exist
    if (full_name) prompt = prompt.replace(/\{full_name\}/g, full_name);
    if (business_name) prompt = prompt.replace(/\{business_name\}/g, business_name);
    if (city) prompt = prompt.replace(/\{city\}/g, city);
    if (job_title) prompt = prompt.replace(/\{job_title\}/g, job_title);
    if (email) prompt = prompt.replace(/\{email\}/g, email);
    if (phone) prompt = prompt.replace(/\{phone\}/g, phone);
    
    // If any placeholders remain, replace with default values
    prompt = prompt.replace(/\{full_name\}/g, 'there');
    prompt = prompt.replace(/\{business_name\}/g, 'your business');
    prompt = prompt.replace(/\{city\}/g, 'your area');
    prompt = prompt.replace(/\{job_title\}/g, 'Business Owner');
    prompt = prompt.replace(/\{email\}/g, '');
    prompt = prompt.replace(/\{phone\}/g, '');
    
    return prompt;
    
  } catch (error) {
    console.error('Error reading script file:', error);
    
    // Fallback to a basic prompt if file read fails
    return `You are Sam, an AI business development representative for Affinity Design, calling ${full_name || 'a potential client'} about our AI services for their business ${business_name || ''}. Your goal is to book a consultation call.`;
  }
}

export default getCustomizedPrompt;
