import mongoose from "mongoose";

let pending: Promise<void> | null = null;

export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (pending) return pending;

  const uri =
    process.env.MONGODB_URI ?? "mongodb://localhost:27017/engram";

  pending = mongoose
    .connect(uri)
    .then(() => {
      console.log("MongoDB connected");
      pending = null;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });

  return pending;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
