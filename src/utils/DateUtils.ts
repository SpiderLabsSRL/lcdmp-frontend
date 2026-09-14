import { Order } from '@/types';
import { format, differenceInHours } from 'date-fns';

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const hoursUntilPickupDateTime = (order: Order) => {
  const pickupDateTime = new Date(
    `${format(order.pickupDate, 'yyyy-MM-dd')}T${order.pickupTime}`
  );

  return differenceInHours(pickupDateTime, new Date());
}