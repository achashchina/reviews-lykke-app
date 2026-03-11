import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId") || "";

    if (!productId) {
      return Response.json({ ok: true, reviews: [] });
    }

    const reviews = await prisma.review.findMany({
      where: { productId, status: "approved" },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ ok: true, reviews });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        where: "loader",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();

    const productId = String(formData.get("productId") || "");
    const name = String(formData.get("name") || "");
    const rating = Number(formData.get("rating"))||5;
    const text = String(formData.get("text") || "");
    const returnTo = String(formData.get("returnTo") || "/");

    if (!productId || !name || !text || rating < 1 || rating > 5) {
      return Response.json(
        { ok: false, error: "Invalid data" },
        { status: 400 },
      );
    }

    const review = await prisma.review.create({
      data: {
        productId,
        name,
        rating,
        text,
        status: "pending",
      },
    });

    return Response.redirect(returnTo, 302);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        where: "action",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
