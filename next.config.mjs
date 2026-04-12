/** @type {import('next').NextConfig} */
function supabaseStorageRemotePattern() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    const hostname = new URL(raw).hostname
    return {
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/**"
    }
  } catch {
    return null
  }
}

const supabasePattern = supabaseStorageRemotePattern()
const remotePatterns = supabasePattern ? [supabasePattern] : []

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true,
    remotePatterns
  }
}

export default nextConfig
