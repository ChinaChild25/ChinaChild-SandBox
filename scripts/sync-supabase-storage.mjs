import { createClient } from "@supabase/supabase-js"

const STORAGE_BUCKETS = ["avatars", "chat-media", "course-covers", "ChinaChildChat"]

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing env var: ${name}`)
  }
  return value
}

function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

function joinPrefix(prefix, name) {
  return prefix ? `${prefix}/${name}` : name
}

async function listAllObjectPaths(client, bucket, prefix = "") {
  const objectPaths = []
  let offset = 0

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" }
    })

    if (error) throw error
    if (!data || data.length === 0) break

    for (const item of data) {
      const path = joinPrefix(prefix, item.name)
      if (!item.id) {
        objectPaths.push(...(await listAllObjectPaths(client, bucket, path)))
        continue
      }
      objectPaths.push(path)
    }

    if (data.length < 100) break
    offset += 100
  }

  return objectPaths
}

async function ensureBucket(source, target, bucketName) {
  const { data: sourceBucket, error: sourceError } = await source.storage.getBucket(bucketName)
  if (sourceError || !sourceBucket) {
    return false
  }

  const { data: targetBucket } = await target.storage.getBucket(bucketName)
  const options = {
    public: Boolean(sourceBucket.public),
    fileSizeLimit: sourceBucket.file_size_limit ?? undefined,
    allowedMimeTypes: sourceBucket.allowed_mime_types ?? undefined
  }

  if (targetBucket) {
    const { error } = await target.storage.updateBucket(bucketName, options)
    if (error) throw error
  } else {
    const { error } = await target.storage.createBucket(bucketName, options)
    if (error) throw error
  }

  return true
}

async function copyBucket(source, target, bucketName) {
  const bucketExists = await ensureBucket(source, target, bucketName)
  if (!bucketExists) {
    console.log(`[skip] ${bucketName} not found in source`)
    return
  }

  const paths = await listAllObjectPaths(source, bucketName)
  console.log(`[bucket] ${bucketName}: ${paths.length} object(s)`)

  for (const path of paths) {
    const { data: blob, error: downloadError } = await source.storage.from(bucketName).download(path)
    if (downloadError || !blob) {
      throw downloadError ?? new Error(`Failed to download ${bucketName}/${path}`)
    }

    const arrayBuffer = await blob.arrayBuffer()
    const fileBody = new Uint8Array(arrayBuffer)
    const contentType = blob.type || "application/octet-stream"

    const { error: uploadError } = await target.storage.from(bucketName).upload(path, fileBody, {
      contentType,
      upsert: true
    })

    if (uploadError) throw uploadError
    console.log(`  -> ${path}`)
  }
}

async function main() {
  const source = createAdminClient(
    requireEnv("SOURCE_SUPABASE_URL"),
    requireEnv("SOURCE_SUPABASE_SERVICE_ROLE_KEY")
  )
  const target = createAdminClient(
    requireEnv("TARGET_SUPABASE_URL"),
    requireEnv("TARGET_SUPABASE_SERVICE_ROLE_KEY")
  )

  for (const bucketName of STORAGE_BUCKETS) {
    await copyBucket(source, target, bucketName)
  }

  console.log("Storage sync complete.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
