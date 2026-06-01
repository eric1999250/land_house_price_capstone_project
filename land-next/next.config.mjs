/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      { source: '/search',     destination: 'http://127.0.0.1:5000/search' },
      { source: '/predict',    destination: 'http://127.0.0.1:5000/predict' },
      { source: '/chat',       destination: 'http://127.0.0.1:5000/chat' },
      { source: '/chat/reset', destination: 'http://127.0.0.1:5000/chat/reset' },
    ]
  }
}
export default nextConfig