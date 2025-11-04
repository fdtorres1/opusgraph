// app/admin/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Composers</CardTitle>
            <CardDescription>Manage composer profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/composers/new">Create New Composer</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Works</CardTitle>
            <CardDescription>Manage musical works</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/works/new">Create New Work</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>View recent changes and activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/admin/activity">View Activity Feed</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

