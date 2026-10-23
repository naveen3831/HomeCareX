import { PricingRuleModel } from '../../models/PricingRule';
import type { GetPricingQuery, PutPricingBody } from './pricing.validation';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const pricingRepository = {
  list(query: GetPricingQuery) {
    return PricingRuleModel.find({
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.city !== undefined ? { city: { $regex: `^${escapeRegex(query.city)}$`, $options: 'i' } } : {}),
    }).sort({ categoryId: 1, serviceId: 1, city: 1 }).lean();
  },

  findExactAnyCase(categoryId: string, serviceId: string | null, city: string) {
    return PricingRuleModel.findOne({
      categoryId,
      serviceId,
      city: { $regex: `^${escapeRegex(city)}$`, $options: 'i' },
    }).lean();
  },

  upsert(input: PutPricingBody, updatedBy: string) {
    const { categoryId, serviceId, city, ...values } = input;
    return PricingRuleModel.findOneAndUpdate(
      { categoryId, serviceId: serviceId ?? null, city },
      { $set: { ...values, updatedBy } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  },

  remove(id: string) {
    return PricingRuleModel.findByIdAndDelete(id).lean();
  },
};
