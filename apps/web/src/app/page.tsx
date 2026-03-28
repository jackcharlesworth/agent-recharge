import { redirect } from "next/navigation";

// Root redirects to a demo /pay page
export default function Home() {
  redirect("/pay?toChain=base&toToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&toAddress=0x0000000000000000000000000000000000000000&agentName=Demo+Agent");
}
