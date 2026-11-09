const clusters = [
  {id:1,name:'Bách khoa – Sư phạm',subtitle:'Liên Chiểu · Hòa Khánh',schools:['ĐH Bách khoa','ĐH Sư phạm'],rooms:426,members:5240,discussions:1284,color:'blue',description:'Cụm phía Tây Bắc, tập trung nhu cầu trọ của sinh viên Bách khoa và Sư phạm.'},
  {id:2,name:'Hòa Cường',subtitle:'Hòa Cường · Núi Thành',schools:['ĐH Kiến trúc','ĐH Đông Á','ĐH Ngoại ngữ'],rooms:318,members:4310,discussions:944,color:'orange',description:'Khu vực trung tâm phía Nam, thuận tiện di chuyển và có nhiều lựa chọn phòng.'},
  {id:3,name:'Hải Châu',subtitle:'Trung tâm thành phố',schools:['ĐH Sư phạm Kỹ thuật','Các cơ sở đào tạo trung tâm'],rooms:205,members:2870,discussions:630,color:'green',description:'Cụm trung tâm, phù hợp sinh viên muốn gần dịch vụ, ăn uống và giao thông.'},
  {id:4,name:'Ngũ Hành Sơn',subtitle:'Ngũ Hành Sơn · Mỹ An',schools:['ĐH Kinh tế','Một số trường lân cận'],rooms:372,members:4680,discussions:1102,color:'purple',description:'Cụm phía Đông Nam, có nhu cầu phòng cao nhờ gần trường và khu dân cư sinh viên.'},
  {id:5,name:'Nam Đà Nẵng',subtitle:'Khu đô thị đại học',schools:['VKU','Khối trường khu đô thị đại học'],rooms:288,members:3960,discussions:821,color:'red',description:'Cụm phía Nam, nổi bật với nhu cầu thuê phòng quanh Khu đô thị Đại học.'}
];
const rooms = [
  {id:1,cluster:1,title:'Phòng 203 · Hòa Khánh',price:2300000,area:25,distance:1.2,verified:91,source:'Facebook',time:'24 phút trước',tags:['Máy lạnh','Chỗ để xe','Wifi'],summary:'Phòng 25m², có máy lạnh, chỗ để xe, gần ĐH Bách khoa. Giá đang được cộng đồng xác nhận.',comments:12,helpful:35,reports:0},
  {id:2,cluster:1,title:'Phòng 22m² · Nguyễn Lương Bằng',price:2100000,area:22,distance:1.4,verified:88,source:'Website công khai',time:'1 giờ trước',tags:['Gác lửng','Máy giặt chung','Wifi'],summary:'Phòng có gác lửng, khu dân cư đông sinh viên, đi bộ và xe máy thuận tiện.',comments:18,helpful:29,reports:1},
  {id:3,cluster:2,title:'Phòng studio · Núi Thành',price:2800000,area:28,distance:1.0,verified:84,source:'Threads',time:'2 giờ trước',tags:['Nội thất','Máy lạnh','Ban công'],summary:'Studio nhỏ, có nội thất cơ bản, phù hợp 1–2 người. Cộng đồng đang thảo luận về chi phí điện.',comments:31,helpful:22,reports:2},
  {id:4,cluster:4,title:'Phòng 20m² · Mỹ An',price:2500000,area:20,distance:1.6,verified:94,source:'Website công khai',time:'3 giờ trước',tags:['Gần trường','Wifi','Bảo vệ'],summary:'Phòng trong khu dân cư, gần ĐH Kinh tế, được cộng đồng đánh giá khá ổn định.',comments:9,helpful:41,reports:0},
  {id:5,cluster:5,title:'Phòng 24m² · Trần Đại Nghĩa',price:1900000,area:24,distance:1.1,verified:90,source:'Facebook',time:'4 giờ trước',tags:['Giá tốt','Chỗ để xe','Wifi'],summary:'Giá mềm, phù hợp sinh viên VKU. Bài đăng đang nhận nhiều bình luận hỏi về điện nước.',comments:16,helpful:37,reports:0}
];
const discussions = [
  {id:11,cluster:1,title:'Khu Hòa Khánh có phòng nào dưới 2 triệu không?',excerpt:'Mình sắp nhập học, ưu tiên chỗ ở sạch và gần trường.',comments:15,ago:'42 phút trước',author:'Minh Anh'},
  {id:12,cluster:2,title:'Review phòng gần Bách khoa, đường Nguyễn Lương Bằng',excerpt:'Ai từng ở khu này cho mình xin review tiền điện, nước và an ninh.',comments:18,ago:'1 giờ trước',author:'Hoàng Nam'},
  {id:13,cluster:4,title:'Mọi người kiểm tra kỹ tiền điện ở khu này nhé',excerpt:'Có vài bài đăng ghi giá điện khác với thông tin chủ nhà nói.',comments:31,ago:'2 giờ trước',author:'Thảo Vy'},
  {id:14,cluster:5,title:'Tìm phòng ghép gần VKU, ngân sách 1,5 triệu',excerpt:'Mình là sinh viên năm nhất, cần chỗ ở từ đầu tháng tới.',comments:7,ago:'3 giờ trước',author:'Gia Huy'}
];
