import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface DashboardSectionErrorProps {
  invalidSection: string;
  validSections: readonly string[];
  dashboardPath: string;
  dashboardName: string;
}

export function DashboardSectionError({ 
  invalidSection, 
  validSections, 
  dashboardPath,
  dashboardName 
}: DashboardSectionErrorProps) {
  const [, setLocation] = useLocation();
  
  // Log for debugging/telemetry
  console.error(`Invalid section "${invalidSection}" for ${dashboardName}. Valid sections:`, validSections);
  
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Section Not Found</CardTitle>
          </div>
          <CardDescription>
            The section "{invalidSection}" doesn't exist in {dashboardName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Available sections:</p>
            <ul className="list-disc list-inside text-sm">
              {validSections.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <Button 
            onClick={() => setLocation(dashboardPath)}
            className="w-full"
            data-testid="button-back-to-dashboard"
          >
            Back to {dashboardName}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
