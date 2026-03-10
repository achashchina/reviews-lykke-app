import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const productId = String(formData.get("productId") || "");
  const name = String(formData.get("name") || "");
  const rating = Number(formData.get("rating") || 5);
  const text = String(formData.get("text") || "");

  if (!productId || !name || !text || rating < 1 || rating > 5) {
    return Response.json({ ok: false, error: "Invalid data" }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      productId,
      name,
      rating,
      text,
    },
  });

  return Response.json({ ok: true, review });
}