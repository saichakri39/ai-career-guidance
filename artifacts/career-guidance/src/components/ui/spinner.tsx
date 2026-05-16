import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

const sizeMap = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<"svg"> & { size?: keyof typeof sizeMap }) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("animate-spin", size ? sizeMap[size] : "size-4", className)}
      {...props}
    />
  )
}

export { Spinner }
