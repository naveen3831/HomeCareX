import UserModel from '../../models/User';

export const maskedCallRepository = {
  findUserPhone(userId: string) {
    return UserModel.findById(userId).select('phone').lean<{ phone?: string }>();
  },
};