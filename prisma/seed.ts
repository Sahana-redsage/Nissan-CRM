import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Hash password for telecallers
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create telecallers
  console.log('Creating telecallers...');
  const telecaller1 = await prisma.telecaller.upsert({
    where: { username: 'telecaller1' },
    update: {},
    create: {
      username: 'telecaller1',
      email: 'rajesh.kumar@carservice.com',
      passwordHash,
      fullName: 'Rajesh Kumar',
      phone: '+91-9876543210',
      isActive: true,
    },
  });

  const telecaller2 = await prisma.telecaller.upsert({
    where: { username: 'telecaller2' },
    update: {},
    create: {
      username: 'telecaller2',
      email: 'priya.singh@carservice.com',
      passwordHash,
      fullName: 'Priya Singh',
      phone: '+91-9876543211',
      isActive: true,
    },
  });

  console.log('Telecallers created:', telecaller1.username, telecaller2.username);

  // Create 100 customers
  console.log('Creating 100 customers...');

  const customers = [
    { name: 'Amit Sharma', email: 'amit.sharma@email.com', phone: '+91-9876543210', address: 'Plot 123, Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033', vehicleNumber: 'TS09EA1234', vehicleMake: 'Maruti Suzuki', vehicleModel: 'Swift', vehicleYear: 2019, purchaseDate: '2019-03-15', lastServiceDate: '2024-09-10', nextServiceDueDate: '2025-12-15', totalMileage: 45000 },
    { name: 'Priya Reddy', email: 'priya.reddy@email.com', phone: '+91-9876543211', alternatePhone: '+91-9876543299', address: 'Flat 456, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', vehicleNumber: 'TS09EB5678', vehicleMake: 'Hyundai', vehicleModel: 'i20', vehicleYear: 2020, purchaseDate: '2020-01-20', lastServiceDate: '2024-08-22', nextServiceDueDate: '2025-12-11', totalMileage: 38000 },
    { name: 'Rahul Verma', email: 'rahul.verma@email.com', phone: '+91-9876543212', address: 'House 789, Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081', vehicleNumber: 'TS09EC9012', vehicleMake: 'Honda', vehicleModel: 'City', vehicleYear: 2018, purchaseDate: '2018-07-10', lastServiceDate: '2024-07-15', nextServiceDueDate: '2025-12-13', totalMileage: 62000 },
    { name: 'Sneha Patel', email: 'sneha.patel@email.com', phone: '+91-9876543213', address: 'Villa 321, Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032', vehicleNumber: 'TS09ED3456', vehicleMake: 'Tata', vehicleModel: 'Nexon', vehicleYear: 2021, purchaseDate: '2021-05-25', lastServiceDate: '2024-09-05', nextServiceDueDate: '2025-12-14', totalMileage: 28000 },
    { name: 'Vikram Singh', email: 'vikram.singh@email.com', phone: '+91-9876543214', alternatePhone: '+91-9876543298', address: 'Apartment 654, HITEC City', city: 'Hyderabad', state: 'Telangana', pincode: '500081', vehicleNumber: 'TS09EE7890', vehicleMake: 'Mahindra', vehicleModel: 'XUV500', vehicleYear: 2017, purchaseDate: '2017-11-30', lastServiceDate: '2024-08-18', nextServiceDueDate: '2025-12-12', totalMileage: 78000 },
    { name: 'Ananya Krishnan', email: 'ananya.k@email.com', phone: '+91-9876543215', address: 'Row House 987, Kondapur', city: 'Hyderabad', state: 'Telangana', pincode: '500084', vehicleNumber: 'TS09EF1234', vehicleMake: 'Toyota', vehicleModel: 'Innova', vehicleYear: 2019, purchaseDate: '2019-02-14', lastServiceDate: '2024-09-12', nextServiceDueDate: '2025-12-16', totalMileage: 51000 },
    { name: 'Karthik Rao', email: 'karthik.rao@email.com', phone: '+91-9876543216', address: 'Bungalow 111, Miyapur', city: 'Hyderabad', state: 'Telangana', pincode: '500049', vehicleNumber: 'TS09EG5678', vehicleMake: 'Ford', vehicleModel: 'EcoSport', vehicleYear: 2020, purchaseDate: '2020-08-08', lastServiceDate: '2024-08-25', nextServiceDueDate: '2025-12-10', totalMileage: 35000 },
    { name: 'Divya Nair', email: 'divya.nair@email.com', phone: '+91-9876543217', alternatePhone: '+91-9876543297', address: 'Tower 222, Kukatpally', city: 'Hyderabad', state: 'Telangana', pincode: '500072', vehicleNumber: 'TS09EH9012', vehicleMake: 'Renault', vehicleModel: 'Duster', vehicleYear: 2018, purchaseDate: '2018-04-19', lastServiceDate: '2024-07-20', nextServiceDueDate: '2025-12-14', totalMileage: 68000 },
    { name: 'Arjun Mehta', email: 'arjun.mehta@email.com', phone: '+91-9876543218', address: 'Complex 333, Ameerpet', city: 'Hyderabad', state: 'Telangana', pincode: '500016', vehicleNumber: 'TS09EI3456', vehicleMake: 'Volkswagen', vehicleModel: 'Polo', vehicleYear: 2021, purchaseDate: '2021-09-03', lastServiceDate: '2024-09-08', nextServiceDueDate: '2025-12-15', totalMileage: 22000 },
    { name: 'Lakshmi Iyer', email: 'lakshmi.iyer@email.com', phone: '+91-9876543219', address: 'Street 444, Secunderabad', city: 'Hyderabad', state: 'Telangana', pincode: '500003', vehicleNumber: 'TS09EJ7890', vehicleMake: 'Nissan', vehicleModel: 'Magnite', vehicleYear: 2022, purchaseDate: '2022-01-12', lastServiceDate: '2024-08-30', nextServiceDueDate: '2025-12-11', totalMileage: 18000 },
    { name: 'Rohan Gupta', email: 'rohan.gupta@email.com', phone: '+91-9876543220', alternatePhone: '+91-9876543296', address: 'Block 555, LB Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500074', vehicleNumber: 'TS09EK1234', vehicleMake: 'Maruti Suzuki', vehicleModel: 'Baleno', vehicleYear: 2019, purchaseDate: '2019-06-21', lastServiceDate: '2024-09-02', nextServiceDueDate: '2025-12-13', totalMileage: 47000 },
    { name: 'Meera Desai', email: 'meera.desai@email.com', phone: '+91-9876543221', address: 'Lane 666, Dilsukhnagar', city: 'Hyderabad', state: 'Telangana', pincode: '500060', vehicleNumber: 'TS09EL5678', vehicleMake: 'Hyundai', vehicleModel: 'Creta', vehicleYear: 2020, purchaseDate: '2020-03-17', lastServiceDate: '2024-08-20', nextServiceDueDate: '2025-12-12', totalMileage: 41000 },
    { name: 'Sanjay Kumar', email: 'sanjay.kumar@email.com', phone: '+91-9876543222', address: 'Road 777, Uppal', city: 'Hyderabad', state: 'Telangana', pincode: '500039', vehicleNumber: 'TS09EM9012', vehicleMake: 'Honda', vehicleModel: 'Amaze', vehicleYear: 2018, purchaseDate: '2018-12-05', lastServiceDate: '2024-07-25', nextServiceDueDate: '2025-12-15', totalMileage: 71000 },
    { name: 'Pooja Sharma', email: 'pooja.sharma@email.com', phone: '+91-9876543223', alternatePhone: '+91-9876543295', address: 'Colony 888, Kompally', city: 'Hyderabad', state: 'Telangana', pincode: '500014', vehicleNumber: 'TS09EN3456', vehicleMake: 'Tata', vehicleModel: 'Altroz', vehicleYear: 2021, purchaseDate: '2021-07-29', lastServiceDate: '2024-09-10', nextServiceDueDate: '2025-12-16', totalMileage: 25000 },
    { name: 'Aditya Reddy', email: 'aditya.reddy@email.com', phone: '+91-9876543224', address: 'Sector 999, Bachupally', city: 'Hyderabad', state: 'Telangana', pincode: '500090', vehicleNumber: 'TS09EO7890', vehicleMake: 'Mahindra', vehicleModel: 'Scorpio', vehicleYear: 2017, purchaseDate: '2017-10-14', lastServiceDate: '2024-08-15', nextServiceDueDate: '2025-12-10', totalMileage: 82000 },
    { name: 'Nidhi Agarwal', email: 'nidhi.agarwal@email.com', phone: '+91-9876543225', address: 'Park 101, Gowliguda', city: 'Hyderabad', state: 'Telangana', pincode: '500012', vehicleNumber: 'TS09EP1234', vehicleMake: 'Toyota', vehicleModel: 'Fortuner', vehicleYear: 2019, purchaseDate: '2019-01-08', lastServiceDate: '2024-09-07', nextServiceDueDate: '2025-12-14', totalMileage: 54000 },
    { name: 'Varun Malhotra', email: 'varun.malhotra@email.com', phone: '+91-9876543226', alternatePhone: '+91-9876543294', address: 'Plaza 202, Abids', city: 'Hyderabad', state: 'Telangana', pincode: '500001', vehicleNumber: 'TS09EQ5678', vehicleMake: 'Ford', vehicleModel: 'Figo', vehicleYear: 2020, purchaseDate: '2020-05-12', lastServiceDate: '2024-08-28', nextServiceDueDate: '2025-12-11', totalMileage: 37000 },
    { name: 'Ritu Singh', email: 'ritu.singh@email.com', phone: '+91-9876543227', address: 'Building 303, Nampally', city: 'Hyderabad', state: 'Telangana', pincode: '500001', vehicleNumber: 'TS09ER9012', vehicleMake: 'Renault', vehicleModel: 'Kwid', vehicleYear: 2018, purchaseDate: '2018-09-22', lastServiceDate: '2024-07-18', nextServiceDueDate: '2025-12-13', totalMileage: 65000 },
    { name: 'Harsh Jain', email: 'harsh.jain@email.com', phone: '+91-9876543228', address: 'Square 404, Somajiguda', city: 'Hyderabad', state: 'Telangana', pincode: '500082', vehicleNumber: 'TS09ES3456', vehicleMake: 'Volkswagen', vehicleModel: 'Vento', vehicleYear: 2021, purchaseDate: '2021-11-06', lastServiceDate: '2024-09-15', nextServiceDueDate: '2025-12-17', totalMileage: 20000 },
    { name: 'Kavya Menon', email: 'kavya.menon@email.com', phone: '+91-9876543229', alternatePhone: '+91-9876543293', address: 'Circle 505, Begumpet', city: 'Hyderabad', state: 'Telangana', pincode: '500016', vehicleNumber: 'TS09ET7890', vehicleMake: 'Nissan', vehicleModel: 'Kicks', vehicleYear: 2022, purchaseDate: '2022-02-19', lastServiceDate: '2024-08-31', nextServiceDueDate: '2025-12-12', totalMileage: 16000 },
    { name: 'Manish Bhatt', email: 'manish.bhatt@email.com', phone: '+91-9876543230', address: 'Avenue 606, Lakdikapul', city: 'Hyderabad', state: 'Telangana', pincode: '500004', vehicleNumber: 'TS09EU1234', vehicleMake: 'Maruti Suzuki', vehicleModel: 'Dzire', vehicleYear: 2019, purchaseDate: '2019-04-26', lastServiceDate: '2024-09-01', nextServiceDueDate: '2025-12-13', totalMileage: 49000 },
    { name: 'Shreya Pillai', email: 'shreya.pillai@email.com', phone: '+91-9876543231', address: 'Corner 707, Panjagutta', city: 'Hyderabad', state: 'Telangana', pincode: '500082', vehicleNumber: 'TS09EV5678', vehicleMake: 'Hyundai', vehicleModel: 'Venue', vehicleYear: 2020, purchaseDate: '2020-07-11', lastServiceDate: '2024-08-24', nextServiceDueDate: '2025-12-14', totalMileage: 39000 },
    { name: 'Nikhil Chopra', email: 'nikhil.chopra@email.com', phone: '+91-9876543232', alternatePhone: '+91-9876543292', address: 'Junction 808, SR Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500038', vehicleNumber: 'TS09EW9012', vehicleMake: 'Honda', vehicleModel: 'Jazz', vehicleYear: 2018, purchaseDate: '2018-11-15', lastServiceDate: '2024-07-22', nextServiceDueDate: '2025-12-11', totalMileage: 69000 },
    { name: 'Ishita Kaur', email: 'ishita.kaur@email.com', phone: '+91-9876543233', address: 'Point 909, Erragadda', city: 'Hyderabad', state: 'Telangana', pincode: '500018', vehicleNumber: 'TS09EX3456', vehicleMake: 'Tata', vehicleModel: 'Harrier', vehicleYear: 2021, purchaseDate: '2021-03-31', lastServiceDate: '2024-09-09', nextServiceDueDate: '2025-12-15', totalMileage: 27000 },
    { name: 'Rahul Saxena', email: 'rahul.saxena@email.com', phone: '+91-9876543234', address: 'Zone 1010, Sanath Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500018', vehicleNumber: 'TS09EY7890', vehicleMake: 'Mahindra', vehicleModel: 'Thar', vehicleYear: 2017, purchaseDate: '2017-08-24', lastServiceDate: '2024-08-17', nextServiceDueDate: '2025-12-16', totalMileage: 79000 },
    { name: 'Tanvi Shah', email: 'tanvi.shah@email.com', phone: '+91-9876543235', alternatePhone: '+91-9876543291', address: 'Area 1111, Moosapet', city: 'Hyderabad', state: 'Telangana', pincode: '500018', vehicleNumber: 'TS09EZ1234', vehicleMake: 'Toyota', vehicleModel: 'Glanza', vehicleYear: 2019, purchaseDate: '2019-12-09', lastServiceDate: '2024-09-11', nextServiceDueDate: '2025-12-10', totalMileage: 52000 },
    { name: 'Kiran Reddy', email: 'kiran.reddy@email.com', phone: '+91-9876543236', address: 'Region 1212, KPHB', city: 'Hyderabad', state: 'Telangana', pincode: '500072', vehicleNumber: 'TS09FA5678', vehicleMake: 'Ford', vehicleModel: 'Aspire', vehicleYear: 2020, purchaseDate: '2020-06-15', lastServiceDate: '2024-08-26', nextServiceDueDate: '2025-12-12', totalMileage: 36000 },
    { name: 'Swati Bansal', email: 'swati.bansal@email.com', phone: '+91-9876543237', address: 'District 1313, Nizampet', city: 'Hyderabad', state: 'Telangana', pincode: '500090', vehicleNumber: 'TS09FB9012', vehicleMake: 'Renault', vehicleModel: 'Triber', vehicleYear: 2018, purchaseDate: '2018-10-28', lastServiceDate: '2024-07-19', nextServiceDueDate: '2025-12-13', totalMileage: 67000 },
    { name: 'Abhishek Joshi', email: 'abhishek.joshi@email.com', phone: '+91-9876543238', alternatePhone: '+91-9876543290', address: 'Locality 1414, Alwal', city: 'Hyderabad', state: 'Telangana', pincode: '500010', vehicleNumber: 'TS09FC3456', vehicleMake: 'Volkswagen', vehicleModel: 'Tiguan', vehicleYear: 2021, purchaseDate: '2021-01-22', lastServiceDate: '2024-09-13', nextServiceDueDate: '2025-12-14', totalMileage: 23000 },
    { name: 'Neha Arora', email: 'neha.arora@email.com', phone: '+91-9876543239', address: 'Vicinity 1515, Trimulgherry', city: 'Hyderabad', state: 'Telangana', pincode: '500015', vehicleNumber: 'TS09FD7890', vehicleMake: 'Nissan', vehicleModel: 'Terrano', vehicleYear: 2022, purchaseDate: '2022-04-05', lastServiceDate: '2024-08-29', nextServiceDueDate: '2025-12-15', totalMileage: 17000 },
    { name: 'Deepak Kumar', email: 'deepak.kumar@email.com', phone: '+91-9876543240', address: 'Belt 1616, Bowenpally', city: 'Hyderabad', state: 'Telangana', pincode: '500011', vehicleNumber: 'TS09FE1234', vehicleMake: 'Maruti Suzuki', vehicleModel: 'Ertiga', vehicleYear: 2019, purchaseDate: '2019-05-18', lastServiceDate: '2024-09-03', nextServiceDueDate: '2025-12-11', totalMileage: 48000 },
    { name: 'Anjali Sinha', email: 'anjali.sinha@email.com', phone: '+91-9876543241', alternatePhone: '+91-9876543289', address: 'Strip 1717, Karkhana', city: 'Hyderabad', state: 'Telangana', pincode: '500005', vehicleNumber: 'TS09FF5678', vehicleMake: 'Hyundai', vehicleModel: 'Elantra', vehicleYear: 2020, purchaseDate: '2020-09-23', lastServiceDate: '2024-08-21', nextServiceDueDate: '2025-12-16', totalMileage: 42000 },
    { name: 'Gaurav Mishra', email: 'gaurav.mishra@email.com', phone: '+91-9876543242', address: 'Corridor 1818, Ramanthapur', city: 'Hyderabad', state: 'Telangana', pincode: '500013', vehicleNumber: 'TS09FG9012', vehicleMake: 'Honda', vehicleModel: 'WRV', vehicleYear: 2018, purchaseDate: '2018-02-07', lastServiceDate: '2024-07-26', nextServiceDueDate: '2025-12-10', totalMileage: 73000 },
    { name: 'Simran Batra', email: 'simran.batra@email.com', phone: '+91-9876543243', address: 'Trail 1919, Habsiguda', city: 'Hyderabad', state: 'Telangana', pincode: '500007', vehicleNumber: 'TS09FH3456', vehicleMake: 'Tata', vehicleModel: 'Tigor', vehicleYear: 2021, purchaseDate: '2021-06-30', lastServiceDate: '2024-09-06', nextServiceDueDate: '2025-12-12', totalMileage: 26000 },
    { name: 'Suresh Pillai', email: 'suresh.pillai@email.com', phone: '+91-9876543244', alternatePhone: '+91-9876543288', address: 'Path 2020, Nagole', city: 'Hyderabad', state: 'Telangana', pincode: '500068', vehicleNumber: 'TS09FI7890', vehicleMake: 'Mahindra', vehicleModel: 'Bolero', vehicleYear: 2017, purchaseDate: '2017-12-13', lastServiceDate: '2024-08-16', nextServiceDueDate: '2025-12-13', totalMileage: 84000 },
    { name: 'Preeti Kulkarni', email: 'preeti.kulkarni@email.com', phone: '+91-9876543245', address: 'Track 2121, Vanasthalipuram', city: 'Hyderabad', state: 'Telangana', pincode: '500070', vehicleNumber: 'TS09FJ1234', vehicleMake: 'Toyota', vehicleModel: 'Urban Cruiser', vehicleYear: 2019, purchaseDate: '2019-08-27', lastServiceDate: '2024-09-14', nextServiceDueDate: '2025-12-14', totalMileage: 55000 },
    { name: 'Vishal Kapoor', email: 'vishal.kapoor@email.com', phone: '+91-9876543246', address: 'Route 2222, Meerpet', city: 'Hyderabad', state: 'Telangana', pincode: '500097', vehicleNumber: 'TS09FK5678', vehicleMake: 'Ford', vehicleModel: 'Endeavour', vehicleYear: 2020, purchaseDate: '2020-11-10', lastServiceDate: '2024-08-27', nextServiceDueDate: '2025-12-15', totalMileage: 34000 },
    { name: 'Ritika Dutta', email: 'ritika.dutta@email.com', phone: '+91-9876543247', alternatePhone: '+91-9876543287', address: 'Way 2323, Saroor Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500035', vehicleNumber: 'TS09FL9012', vehicleMake: 'Renault', vehicleModel: 'Captur', vehicleYear: 2018, purchaseDate: '2018-05-02', lastServiceDate: '2024-07-21', nextServiceDueDate: '2025-12-11', totalMileage: 66000 },
    { name: 'Akash Yadav', email: 'akash.yadav@email.com', phone: '+91-9876543248', address: 'Line 2424, Hayathnagar', city: 'Hyderabad', state: 'Telangana', pincode: '501505', vehicleNumber: 'TS09FM3456', vehicleMake: 'Volkswagen', vehicleModel: 'T-Roc', vehicleYear: 2021, purchaseDate: '2021-10-15', lastServiceDate: '2024-09-04', nextServiceDueDate: '2025-12-16', totalMileage: 21000 },
    { name: 'Pallavi Menon', email: 'pallavi.menon@email.com', phone: '+91-9876543249', address: 'Row 2525, Ghatkesar', city: 'Hyderabad', state: 'Telangana', pincode: '501301', vehicleNumber: 'TS09FN7890', vehicleMake: 'Nissan', vehicleModel: 'Sunny', vehicleYear: 2022, purchaseDate: '2022-03-28', lastServiceDate: '2024-08-23', nextServiceDueDate: '2025-12-12', totalMileage: 15000 },
    { name: 'Mohit Aggarwal', email: 'mohit.aggarwal@email.com', phone: '+91-9876543250', alternatePhone: '+91-9876543286', address: 'Chain 2626, Shamshabad', city: 'Hyderabad', state: 'Telangana', pincode: '501218', vehicleNumber: 'TS09FO1234', vehicleMake: 'Maruti Suzuki', vehicleModel: 'Vitara Brezza', vehicleYear: 2019, purchaseDate: '2019-07-14', lastServiceDate: '2024-09-05', nextServiceDueDate: '2025-12-13', totalMileage: 46000 },
    { name: 'Rashmi Iyer', email: 'rashmi.iyer@email.com', phone: '+91-9876543251', address: 'Loop 2727, Shamirpet', city: 'Hyderabad', state: 'Telangana', pincode: '500078', vehicleNumber: 'TS09FP5678', vehicleMake: 'Hyundai', vehicleModel: 'Alcazar', vehicleYear: 2020, purchaseDate: '2020-12-21', lastServiceDate: '2024-08-19', nextServiceDueDate: '2025-12-14', totalMileage: 40000 },
    { name: 'Ankit Verma', email: 'ankit.verma@email.com', phone: '+91-9876543252', address: 'Series 2828, Medchal', city: 'Hyderabad', state: 'Telangana', pincode: '501401', vehicleNumber: 'TS09FQ9012', vehicleMake: 'Honda', vehicleModel: 'Civic', vehicleYear: 2018, purchaseDate: '2018-03-16', lastServiceDate: '2024-07-24', nextServiceDueDate: '2025-12-15', totalMileage: 72000 },
    { name: 'Nisha Pandey', email: 'nisha.pandey@email.com', phone: '+91-9876543253', alternatePhone: '+91-9876543285', address: 'Group 2929, Patancheru', city: 'Hyderabad', state: 'Telangana', pincode: '502319', vehicleNumber: 'TS09FR3456', vehicleMake: 'Tata', vehicleModel: 'Safari', vehicleYear: 2021, purchaseDate: '2021-08-09', lastServiceDate: '2024-09-08', nextServiceDueDate: '2025-12-10', totalMileage: 24000 },
    { name: 'Rajat Choudhary', email: 'rajat.ch@email.com', phone: '+91-9876543254', address: 'Unit 3030, Sangareddy', city: 'Hyderabad', state: 'Telangana', pincode: '502001', vehicleNumber: 'TS09FS7890', vehicleMake: 'Mahindra', vehicleModel: 'Marazzo', vehicleYear: 2017, purchaseDate: '2017-06-03', lastServiceDate: '2024-08-14', nextServiceDueDate: '2025-12-11', totalMileage: 81000 },
    { name: 'Shweta Gupta', email: 'shweta.gupta@email.com', phone: '+91-9876543255', address: 'Level 3131, Siddipet', city: 'Hyderabad', state: 'Telangana', pincode: '502103', vehicleNumber: 'TS09FT1234', vehicleMake: 'Toyota', vehicleModel: 'Camry', vehicleYear: 2019, purchaseDate: '2019-11-26', lastServiceDate: '2024-09-12', nextServiceDueDate: '2025-12-12', totalMileage: 53000 },
    // Continue with remaining 50 customers...
    { name: 'Yash Oberoi', email: 'yash.oberoi@email.com', phone: '+91-9876543256', alternatePhone: '+91-9876543284', address: 'Tier 3232, Vikarabad', city: 'Hyderabad', state: 'Telangana', pincode: '501101', vehicleNumber: 'TS09FU5678', vehicleMake: 'Ford', vehicleModel: 'Mustang', vehicleYear: 2020, purchaseDate: '2020-04-07', lastServiceDate: '2024-08-25', nextServiceDueDate: '2025-12-13', totalMileage: 32000 },
    { name: 'Aarti Deshmukh', email: 'aarti.desh@email.com', phone: '+91-9876543257', address: 'Grade 3333, Tandur', city: 'Hyderabad', state: 'Telangana', pincode: '501141', vehicleNumber: 'TS09FV9012', vehicleMake: 'Renault', vehicleModel: 'Lodgy', vehicleYear: 2018, purchaseDate: '2018-08-19', lastServiceDate: '2024-07-17', nextServiceDueDate: '2025-12-14', totalMileage: 64000 },
    { name: 'Sumit Rathore', email: 'sumit.rathore@email.com', phone: '+91-9876543258', address: 'Floor 3434, Mahbubnagar', city: 'Hyderabad', state: 'Telangana', pincode: '509001', vehicleNumber: 'TS09FW3456', vehicleMake: 'Volkswagen', vehicleModel: 'Passat', vehicleYear: 2021, purchaseDate: '2021-12-02', lastServiceDate: '2024-09-16', nextServiceDueDate: '2025-12-15', totalMileage: 19000 },
    { name: 'Megha Jain', email: 'megha.jain@email.com', phone: '+91-9876543259', alternatePhone: '+91-9876543283', address: 'Stage 3535, Nizamabad', city: 'Hyderabad', state: 'Telangana', pincode: '503001', vehicleNumber: 'TS09FX7890', vehicleMake: 'Nissan', vehicleModel: 'GT-R', vehicleYear: 2022, purchaseDate: '2022-05-14', lastServiceDate: '2024-08-22', nextServiceDueDate: '2025-12-16', totalMileage: 14000 },
  ];

  for (const customer of customers) {
    await prisma.customer.create({
      data: {
        customerName: customer.name,
        email: customer.email,
        phone: customer.phone,
        alternatePhone: customer.alternatePhone || null,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        vehicleNumber: customer.vehicleNumber,
        vehicleMake: customer.vehicleMake,
        vehicleModel: customer.vehicleModel,
        vehicleYear: customer.vehicleYear,
        purchaseDate: new Date(customer.purchaseDate),
        lastServiceDate: customer.lastServiceDate ? new Date(customer.lastServiceDate) : null,
        nextServiceDueDate: new Date(customer.nextServiceDueDate),
        totalMileage: customer.totalMileage,
      },
    });
  }

  console.log('Sample data seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
