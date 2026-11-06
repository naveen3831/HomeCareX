import { BannerModel } from '../../models/Banner';

export class MarketingRepository {
  async listAdmin() {
    return BannerModel.find({})
      .sort({
        placement: 1,
        order: 1,
        createdAt: -1,
      })
      .lean();
  }

  async findById(id: string) {
    return BannerModel.findById(id);
  }

  async create(data: Record<string, unknown>) {
    return BannerModel.create(data);
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ) {
    return BannerModel.findByIdAndUpdate(
      id,
      { $set: data },
      {
        new: true,
        runValidators: true,
      },
    );
  }

  async remove(id: string) {
    return BannerModel.findByIdAndDelete(id);
  }

  async listPublic(placement?: string) {
    const now = new Date();

    const filter: Record<string, unknown> = {
      active: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
    };

    if (placement) {
      // The app asks for "home"; the database stores "HOME", "HOME_TOP", "HOME_MIDDLE", "HOME_BOTTOM".
      // The Home page has no separate slots yet, so "home" returns every HOME* banner
      // (before this, only banners saved with placement exactly "HOME" ever showed up).
      const wanted = placement.trim().toUpperCase();
      filter.placement =
        wanted === 'HOME'
          ? { $in: ['HOME', 'HOME_TOP', 'HOME_MIDDLE', 'HOME_BOTTOM'] }
          : wanted;
    }

    return BannerModel.find(filter)
      .sort({
        order: 1,
        createdAt: -1,
      })
      .lean();
  }
}

export const marketingRepository =
  new MarketingRepository();