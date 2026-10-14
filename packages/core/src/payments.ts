import { api } from "./index";
import { PaymentProvider } from "./domain";
export type Checkout = { id: string; mode: "test"; checkoutURL?: string };
export interface CreatorPayments extends PaymentProvider {
  tip(creator: string, amountPaise: number): Promise<Checkout>;
  subscribe(creator: string): Promise<Checkout>;
  enablePlan(creator: string, amountPaise: number): Promise<Checkout>;
}
export class RazorpayTestAdapter implements CreatorPayments {
  private async request(
    kind: "tip" | "subscribe" | "plan",
    creatorId: string,
    amountPaise = 100,
  ) {
    const { data, error } = await api.functions.invoke("payment", {
      body: { creatorId, amountPaise, kind },
    });
    if (error || data?.error) throw new Error(error?.message || data.error);
    if (data?.mode !== "test")
      throw new Error("Production payments are disabled");
    return data as Checkout;
  }
  tip(creator: string, amountPaise: number) {
    return this.request("tip", creator, amountPaise);
  }
  subscribe(creator: string) {
    return this.request("subscribe", creator);
  }
  enablePlan(creator: string, amountPaise: number) {
    return this.request("plan", creator, amountPaise);
  }
}
export const creatorPayments: CreatorPayments = new RazorpayTestAdapter();
