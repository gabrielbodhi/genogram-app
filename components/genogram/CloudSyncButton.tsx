'use client';

import React, { useEffect, useState } from 'react';
import { Cloud, CloudUpload, CloudDownload, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  pushToCloud,
  pullFromCloud,
  signInWithEmailLink,
  signOut,
} from '@/lib/cloud/sync';
import { getSupabase, isCloudConfigured } from '@/lib/cloud/supabase';

export default function CloudSyncButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      setUser(data.user?.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isCloudConfigured()) return null;

  const onPush = async () => {
    setBusy(true);
    await pushToCloud();
    setBusy(false);
  };
  const onPull = async () => {
    setBusy(true);
    await pullFromCloud();
    setBusy(false);
  };
  const onSignIn = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const ok = await signInWithEmailLink(email.trim());
    setBusy(false);
    if (ok) setOpen(false);
  };
  const onSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Cloud sync">
          <Cloud className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cloud sync</DialogTitle>
          <DialogDescription>
            Push the current genogram to your account or pull the latest cloud
            version. Last writer wins — coordinate with collaborators.
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user}</span>
            </p>
            <div className="flex gap-2">
              <Button onClick={onPush} disabled={busy} className="flex-1">
                <CloudUpload className="mr-2 h-4 w-4" />
                Push
              </Button>
              <Button
                onClick={onPull}
                disabled={busy}
                variant="outline"
                className="flex-1"
              >
                <CloudDownload className="mr-2 h-4 w-4" />
                Pull
              </Button>
            </div>
            <Button
              onClick={onSignOut}
              disabled={busy}
              variant="ghost"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in via magic link to enable cloud sync.
            </p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSignIn();
              }}
            />
            <DialogFooter>
              <Button onClick={onSignIn} disabled={busy} className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Send magic link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
