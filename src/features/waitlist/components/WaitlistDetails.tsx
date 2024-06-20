import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createWaitlistClientForProcess } from "../contract/waitlistClient";
import { AoWallet } from "@/features/ao/lib/aoWallet";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import humanizeDuration from "humanize-duration";

const waitlistProcessId = import.meta.env.VITE_WAITLIST_PROCESS_ID! as string;
const bumpCooldown = 12 * 60 * 60 * 1000;

interface WaitlistDetailsProps {
  wallet: AoWallet;
}

export function WaitlistDetails({
  wallet,
}: WaitlistDetailsProps) {
  const resolvedWallet = wallet;

  const waitlistState = useSuspenseQuery({
    queryKey: ['waitlist', waitlistProcessId, resolvedWallet.address, 'state'],
    queryFn: async () => {
      const waitlistCLient = createWaitlistClientForProcess(resolvedWallet)(waitlistProcessId)
      return waitlistCLient.readState();
    },
    refetchInterval: 10_000,
  })

  const waitlistRegister = useMutation({
    mutationKey: ['waitlist', waitlistProcessId, resolvedWallet.address, 'register'],
    mutationFn: async () => {
      const waitlistCLient = createWaitlistClientForProcess(resolvedWallet)(waitlistProcessId)
      return await waitlistCLient.register();
    },
    onSuccess: () => {
      waitlistState.refetch();
    },
  });

  const walletlistBump = useMutation({
    mutationKey: ['waitlist', waitlistProcessId, resolvedWallet.address, 'bump'],
    mutationFn: async () => {
      const waitlistCLient = createWaitlistClientForProcess(resolvedWallet)(waitlistProcessId)
      return await waitlistCLient.bump();
    },
    onSuccess: () => {
      waitlistState.refetch();
    },
  });

  const lastBump = waitlistState.data.User?.TimestampLastBumped
  const [timeLeft, setTimeLeft] = useState(bumpCooldown)
  const canBump = timeLeft <= 0;

  useEffect(() => {
    if (!lastBump) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - lastBump;
      const timeLeft = Math.max(bumpCooldown - diff, 0);
      setTimeLeft(timeLeft);
    }, 1000)

    return () => clearInterval(interval)
  }, [lastBump, walletlistBump])


  return (
    <div className="flex flex-col justify-evenly items-center h-[25%] min-h-44">
      {
        waitlistState.data.UserPosition === 0 ? (
          <p className="text-2xl">
            You are not yet on the Waitlist
          </p>
        ) : (
          <p className="text-2xl">
            You are at position <span className="text-purple-300">{waitlistState.data.UserPosition}</span> / <span className="text-purple-300">{waitlistState.data.Count}</span> on the Waitlist
          </p>
        )
      }
      <div className="flex flex-col items-center gap-2">
      {
        waitlistState.data.User !== undefined && (
          <p className="text-lg">
            Next bump in <span className="italic">{humanizeDuration(timeLeft, { round: true })}</span>...
          </p>
        )
      }
      {
        waitlistState.data.User === undefined ? (
          <Button
            onClick={() => waitlistRegister.mutate()}
            disabled={waitlistRegister.isPending || waitlistRegister.isSuccess}
          >
            Register
          </Button>
        ) : (
          <Button
            onClick={() => walletlistBump.mutate()}
            disabled={!canBump || walletlistBump.isPending || walletlistBump.isSuccess}
          >
            {canBump ? 'Bump your spot!' : 'Bump cooldown...'}
          </Button>
        )
      }
      </div>
    </div>
  )
}
