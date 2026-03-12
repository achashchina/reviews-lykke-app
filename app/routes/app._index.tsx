import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const totalReviews = await prisma.review.count();

  const pendingReviews = await prisma.review.count({
    where: { status: "pending" },
  });

  const approvedReviews = await prisma.review.count({
    where: { status: "approved" },
  });

  const rejectedReviews = await prisma.review.count({
    where: { status: "rejected" },
  });

  const products = await prisma.review.findMany({
    distinct: ["productId"],
    select: { productId: true },
  });

  return Response.json({
    shop: session.shop,
    totalReviews,
    pendingReviews,
    approvedReviews,
    rejectedReviews,
    productsWithReviews: products.length,
  });
}

export default function Index() {
  const {
    shop,
    totalReviews,
    pendingReviews,
    approvedReviews,
    rejectedReviews,
    productsWithReviews,
  } = useLoaderData() as {
    shop: string;
    totalReviews: number;
    pendingReviews: number;
    approvedReviews: number;
    rejectedReviews: number;
    productsWithReviews: number;
  };

  return (
    <s-page heading="Reviews dashboard">
      <s-section heading="Overview">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
          <StatCard label="Total reviews" value={String(totalReviews)} />
          <StatCard label="Pending" value={String(pendingReviews)} />
          <StatCard label="Approved" value={String(approvedReviews)} />
          <StatCard label="Rejected" value={String(rejectedReviews)} />
        </div>
      </s-section>

      <s-section heading="Store summary">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
          <InfoCard
            title="Connected store"
            value={shop}
            text="Your app is connected and ready to manage product reviews."
          />
          <InfoCard
            title="Products with reviews"
            value={String(productsWithReviews)}
            text="Unique products that already have at least one review."
          />
        </div>
      </s-section>

      <s-section heading="Quick actions">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            to="/app/reviews"
            style={primaryLinkStyle}
          >
            Open moderation
          </Link>

          <a
            href={`https://${shop}/admin/themes/current/editor`}
            target="_blank"
            rel="noreferrer"
            style={secondaryLinkStyle}
          >
            Open theme editor
          </a>

          <a
            href={`https://${shop}/products`}
            target="_blank"
            rel="noreferrer"
            style={secondaryLinkStyle}
          >
            Open products
          </a>
        </div>
      </s-section>

      <s-section heading="How it works">
        <div style={panelStyle}>
          <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
            <li>Customers leave reviews on the storefront.</li>
            <li>New reviews can be saved as pending or approved.</li>
            <li>You can manage all reviews from the moderation page.</li>
            <li>The storefront block shows only the reviews you want to publish.</li>
          </ul>
        </div>
      </s-section>

      <s-section slot="aside" heading="Next steps">
        <div style={panelStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link to="/app/reviews" style={asideLinkStyle}>
              Review moderation
            </Link>
            <span style={{ color: "#6b7280" }}>
              Approve, reject, and create reviews manually.
            </span>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>{value}</div>
      <div style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "18px",
  background: "white",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "18px",
  background: "white",
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  borderRadius: "8px",
  background: "#111827",
  color: "white",
  textDecoration: "none",
  fontWeight: 600,
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 500,
};

const asideLinkStyle: React.CSSProperties = {
  color: "#111827",
  textDecoration: "none",
  fontWeight: 600,
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};