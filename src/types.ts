export interface Donation {
  id: string;
  donor: string;
  type: string;
  items: string;
  location: string;
  status: string;
  time?: string;
  temperature?: string;
  deadline?: string;
  contact?: string;
  donorRating?: number;
  authorUid: string;
  createdAt: string;
}

export interface NGO {
  id: string;
  name: string;
  focus: string;
  area: string;
  rating: number;
  verified: boolean;
}

export interface Message {
  id: string;
  connectionId: string;
  sender: string;
  senderUid: string;
  text: string;
  timestamp: string;
}

export interface Connection {
  id: string;
  donationId: string;
  restaurant: string;
  ngo: string;
  donationItems: string;
  status: 'Pending' | 'In Transit' | 'Completed';
  timestamp: string;
  rated?: boolean;
  donorUid: string;
  ngoUid: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'restaurant' | 'ngo' | 'admin';
  rating?: number;
  location?: string;
}
