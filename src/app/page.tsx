import Link from "next/link";
import NavBar from "@/components/NavBar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <NavBar />

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12">
        <h1 className="text-5xl font-bold mb-6">Ultra-fast Search for Developers</h1>
        <p className="text-xl mb-8 max-w-2xl">
          Zearchy provides lightning-fast, in-memory search capabilities using our optimized ZipTrie algorithm. 
          Perfect for mobile apps and low-latency environments.
        </p>
        <div className="flex gap-4">
          <Link 
            href="/sign-up" 
            className="bg-blue-600 text-white px-6 py-3 rounded-md text-lg hover:bg-blue-700"
          >
            Get Started
          </Link>
          <a 
            href="#comparison" 
            className="border border-gray-300 px-6 py-3 rounded-md text-lg hover:bg-gray-50"
          >
            See Performance
          </a>
        </div>
      </section>

      {/* Performance Comparison */}
      <section id="comparison" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-extrabold text-black text-center mb-12">Performance Advantages</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black mb-4 text-center">Lightning Fast</h3>
              <p className="text-gray-800 text-center">
                Optimized in-memory search delivers results in milliseconds, even for complex queries
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black mb-4 text-center">Offline Capable</h3>
              <p className="text-gray-800 text-center">
                Works without an internet connection, with compressed local storage for large datasets
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 text-purple-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black mb-4 text-center">Memory Efficient</h3>
              <p className="text-gray-800 text-center">
                Our ZipTrie algorithm uses significantly less memory than traditional search solutions
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 text-yellow-600 mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-black mb-4 text-center">Benchmarked</h3>
              <p className="text-gray-800 text-center">
                Consistently outperforms traditional search solutions in response time and resource usage
              </p>
            </div>
          </div>
          
          <div className="mt-16 max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold text-black mb-6 text-center">Real-Time Performance Metrics</h3>
            <p className="text-gray-800 mb-6 text-center">
              Try our interactive demo to see real-time search performance metrics on your own datasets
            </p>
            <div className="flex justify-center">
              <Link 
                href="/sign-up" 
                className="bg-blue-600 text-white px-6 py-3 rounded-md text-lg hover:bg-blue-700"
              >
                Try Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-gray-800 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-extrabold text-white text-center mb-12">Perfect For</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border border-gray-600 rounded-lg bg-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Mobile Apps</h3>
              <p className="text-gray-200">
                Minimize latency and bandwidth usage with our optimized search algorithm.
              </p>
            </div>
            
            <div className="p-6 border border-gray-600 rounded-lg bg-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Startups</h3>
              <p className="text-gray-200">
                Affordable alternative to expensive search solutions with simple integration.
              </p>
            </div>
            
            <div className="p-6 border border-gray-600 rounded-lg bg-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Data Teams</h3>
              <p className="text-gray-200">
                Low-latency full-text search over structured datasets with minimal setup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <h2 className="text-2xl font-bold mb-4">Zearchy</h2>
              <p className="max-w-md text-gray-300">
                High-performance, memory-efficient search platform using ZipTrie algorithm.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link href="/sign-up" className="text-gray-300 hover:text-white">Get Started</Link></li>
                <li><a href="#comparison" className="text-gray-300 hover:text-white">Performance</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white">Documentation</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Zearchy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
