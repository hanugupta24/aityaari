"use client";

import { StudyMaterialUpload } from "@/components/study-material-upload";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function UploadPage() {
  const { canUploadStudyMaterials } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!canUploadStudyMaterials) {
      router.push("/studyMaterials");
    }
  }, [canUploadStudyMaterials, router]);

  if (!canUploadStudyMaterials) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle>Permission Denied</CardTitle>
            </div>
            <CardDescription>
              You don't have permission to upload study materials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Please contact an administrator if you believe you should have
              access to this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <StudyMaterialUpload />
    </div>
  );
}
