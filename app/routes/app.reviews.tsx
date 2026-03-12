import { Form, useLoaderData } from "react-router";
import { useState } from "react";
import prisma from "../db.server";
import type { ActionFunctionArgs } from "react-router";
import { useActionData } from "react-router";
import { useEffect } from "react";

import { authenticate } from "../shopify.server";

type Review = {
  id: string;
  productId: string;
  name: string;
  rating: number;
  text: string;
  status: string;
};

async function syncProductReviewMetafields(
  admin: any,
  productId: string,
) {
  const reviews = await prisma.review.findMany({
    where: {
      productId,
      status: "approved",
    },
    select: {
      rating: true,
    },
  });

  const reviewsCount = reviews.length;
  const averageRating =
    reviewsCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewsCount
      : 0;

  const productGid = `gid://shopify/Product/${productId}`;

  const mutation = `#graphql
    mutation SetProductReviewMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: productGid,
          namespace: "custom",
          key: "average_rating",
          type: "number_decimal",
          value: averageRating.toFixed(1),
        },
        {
          ownerId: productGid,
          namespace: "custom",
          key: "reviews_count",
          type: "number_integer",
          value: String(reviewsCount),
        },
      ],
    },
  });

  const result = await response.json();

  if (result.data?.metafieldsSet?.userErrors?.length) {
    throw new Error(
      JSON.stringify(result.data.metafieldsSet.userErrors, null, 2),
    );
  }
}

export async function loader({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
  });

  const productIds = [...new Set(reviews.map((r) => r.productId))];

  const productImages: Record<string, string> = {};

  if (productIds.length) {
    const query = `
        query getProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              featuredImage {
                url
              }
            }
          }
        }
      `;

    const ids = productIds.map((id) => `gid://shopify/Product/${id}`);

    const response = await admin.graphql(query, { variables: { ids } });

    const data = await response.json();

    data.data.nodes.forEach((p:any) => {
      if (!p) return;

      const productId = p.id.split("/").pop();

      productImages[productId] = p.featuredImage?.url || "";
    });
  }

  const { session } = await authenticate.admin(request);

  return Response.json({
    reviews,
    productImages,
    shop: session.shop,
  });
}

export async function action({ request }: ActionFunctionArgs) {
    const { admin } = await authenticate.admin(request);

  const formData = await request.formData();

  const actionType = String(formData.get("action") || "");
  const productId = String(formData.get("productId") || "");

  if (actionType === "approve") {
    const id = String(formData.get("id") || "");

    await prisma.review.update({
      where: { id },
      data: { status: "approved" },
    });

    await syncProductReviewMetafields(admin, productId);
    return Response.json({ ok: true });
  }

  if (actionType === "reject") {
    const id = String(formData.get("id") || "");

    await prisma.review.update({
      where: { id },
      data: { status: "rejected" },
    });

    await syncProductReviewMetafields(admin, productId);

    return Response.json({ ok: true });
  }

  if (actionType === "create") {
    const productId = String(formData.get("productId") || "");
    const name = String(formData.get("name") || "");
    const rating = Number(formData.get("rating") || 5);
    const text = String(formData.get("text") || "");

    if (!productId || !name || !text || rating < 1 || rating > 5) {
      return Response.json(
        { ok: false, error: "Invalid data" },
        { status: 400 },
      );
    }

    await prisma.review.create({
      data: {
        productId,
        name,
        rating,
        text,
        status: "approved",
      },
    });

    await syncProductReviewMetafields(admin, productId);

    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

export default function ReviewsAdmin() {
  const { reviews } = useLoaderData() as { reviews: Review[] };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { productImages } = useLoaderData();
  const { shop } = useLoaderData();

  const actionData = useActionData();

  useEffect(() => {
    if (actionData?.ok) {
      setIsModalOpen(false);
    }
  }, [actionData]);

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ margin: 0 }}>Reviews</h1>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            border: "none",
            background: "black",
            color: "white",
            padding: "10px 16px",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Add review
        </button>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f8f8" }}>
              <th style={thStyle}>Image</th>
              <th style={thStyle}>Product ID</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Rating</th>
              <th style={thStyle}>Review</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {reviews.map((review) => (
              <tr key={review.id}>
                <td style={tdStyle}>
                  {productImages[review.productId] && (
                    <img
                      src={productImages[review.productId]}
                      style={{
                        width: 50,
                        height: 50,
                        objectFit: "cover",
                        borderRadius: 6,
                      }}
                    />
                  )}
                </td>
                <td style={tdStyle}>
                  <a
                    href={`https://${shop}/admin/products/${review.productId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#2563eb",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    {review.productId}
                  </a>
                </td>
                <td style={tdStyle}>{review.name}</td>
                <td style={tdStyle}>{review.rating}</td>
                <td style={tdStyle}>{review.text}</td>
                <td style={tdStyle}>{review.status}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Form method="post">
                      <input type="hidden" name="id" value={review.id} />
                      <button
                        type="submit"
                        name="action"
                        value="approve"
                        style={approveBtnStyle}
                      >
                        Approve
                      </button>
                    </Form>

                    <Form method="post">
                      <input type="hidden" name="id" value={review.id} />
                      <button
                        type="submit"
                        name="action"
                        value="reject"
                        style={rejectBtnStyle}
                      >
                        Reject
                      </button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ margin: 0 }}>Add review</h2>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <Form method="post">
              <input type="hidden" name="action" value="create" />

              <div style={fieldStyle}>
                <label style={labelStyle}>Product ID</label>
                <input name="productId" required style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Name</label>
                <input name="name" required style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Rating</label>
                <select name="rating" defaultValue="5" style={inputStyle}>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Review text</label>
                <textarea name="text" required style={textareaStyle} />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={secondaryBtnStyle}
                >
                  Cancel
                </button>

                <button type="submit" style={primaryBtnStyle}>
                  Save review
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top" as const,
};

const approveBtnStyle = {
  border: "none",
  background: "#111827",
  color: "white",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
};

const rejectBtnStyle = {
  border: "none",
  background: "#dc2626",
  color: "white",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
};

const overlayStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle = {
  width: "100%",
  maxWidth: "560px",
  background: "white",
  borderRadius: "12px",
  padding: "24px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
};

const fieldStyle = {
  marginBottom: "16px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  boxSizing: "border-box" as const,
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "110px",
};

const primaryBtnStyle = {
  border: "none",
  background: "black",
  color: "white",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
};

const secondaryBtnStyle = {
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111827",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
};
