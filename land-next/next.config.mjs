/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      { source: '/search',     destination: 'https://land-price-api-35fr.onrender.com/search' },
      { source: '/predict',    destination: 'https://land-price-api-35fr.onrender.com/predict' },
      { source: '/chat',       destination: 'https://land-price-api-35fr.onrender.com/chat' },
      { source: '/chat/reset', destination: 'https://land-price-api-35fr.onrender.com/chat/reset' },
    ]
  }
}
export default nextConfig