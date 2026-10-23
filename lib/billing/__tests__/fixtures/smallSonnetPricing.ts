/** Synthetic public endpoint contract; never a live pricing receipt. */
export function smallSonnetPricingFixture() {
  return { data: { id: "anthropic/claude-sonnet-5", reasoning: { mandatory: false, supports_max_tokens: true, supported_efforts: ["none", "low"] }, endpoints: [{ provider_name: "anthropic", status: 0, max_completion_tokens: 128000, supported_parameters: ["max_tokens", "reasoning"], pricing: { prompt: "0.000002", completion: "0.00001", request: "0", image: "0", web_search: "0.01", internal_reasoning: "0", input_cache_read: "0.0000002", input_cache_write: "0.0000025", discount: 0 }, inference_regions: [{ pricing: { prompt: "0.0000022", completion: "0.000011", input_cache_read: "0.00000022", input_cache_write: "0.00000275" } }] }] } };
}
