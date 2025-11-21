import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { isDevelopment, TEST_USERS, getTestUserId, setTestUserId } from "@/lib/devMode";

export function TestUserSwitcher() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedUserId(getTestUserId());
  }, []);

  if (!isDevelopment) {
    return null;
  }

  const handleUserChange = (userId: string) => {
    if (userId === "none") {
      setTestUserId(null);
      setSelectedUserId(null);
      window.location.reload();
    } else {
      setTestUserId(userId);
      setSelectedUserId(userId);
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
        DEV MODE
      </Badge>
      <Select value={selectedUserId || "none"} onValueChange={handleUserChange}>
        <SelectTrigger className="w-40" data-testid="select-test-user">
          <SelectValue placeholder="Real User" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Real User</SelectItem>
          {TEST_USERS.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
