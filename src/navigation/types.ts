import { NavigatorScreenParams } from '@react-navigation/native';
import { TripType } from '@/types';

export type RootStackParamList = {
  Welcome: undefined;
  Auth: { mode?: 'Log In' | 'Sign Up' } | undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ParksTab: undefined;
  LogTrip: NavigatorScreenParams<LogTripStackParamList>;
  TripsTab: undefined;
  ProfileTab: undefined;
};

export type LogTripFormParams = {
  parkId?: string;
  tripId?: string;
  completeTripId?: string;
  initialTripType?: TripType;
} | undefined;

export type LogTripStackParamList = {
  TripChooser: undefined;
  LogTripForm: LogTripFormParams;
};

// ParkDetail and its children, plus TripDetail/LogTripForm, are each
// registered in every tab whose screens can link to them (mirroring the
// existing ParkDetail duplication between Home/Parks below) so a link from
// any tab pushes onto that tab's OWN stack rather than jumping into another
// tab's separate history — otherwise that other tab's back button pops
// through its own history instead of returning to where the user came from.
export type HomeStackParamList = {
  Home: undefined;
  ParkDetail: { parkId: string };
  ParkTrails: { parkId: string };
  ParkAnimals: { parkId: string };
  TrailDetail: { trailId: string };
  AnimalDetail: { animalId: string };
  TripDetail: { tripId: string };
  LogTripForm: LogTripFormParams;
};

export type ParksStackParamList = {
  Explore: undefined;
  ParkDetail: { parkId: string };
  ParkTrails: { parkId: string };
  ParkAnimals: { parkId: string };
  TrailDetail: { trailId: string };
  AnimalDetail: { animalId: string };
  TripDetail: { tripId: string };
  LogTripForm: LogTripFormParams;
};

export type TripsStackParamList = {
  Trips: undefined;
  TripDetail: { tripId: string };
  TripPhotoAlbum: { tripId: string };
  LogTripForm: LogTripFormParams;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Postcards: undefined;
  Collection: undefined;
  Stats: undefined;
  Wishlist: undefined;
  PhotoAlbum: undefined;
  TripPhotoAlbum: { tripId: string };
  TripDetail: { tripId: string };
  ParkDetail: { parkId: string };
  ParkTrails: { parkId: string };
  ParkAnimals: { parkId: string };
  TrailDetail: { trailId: string };
  AnimalDetail: { animalId: string };
  Settings: undefined;
  EditProfile: undefined;
  EditGoal: undefined;
  Units: undefined;
  About: undefined;
};
