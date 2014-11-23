-- these are the fields:

-- comm_city,
-- comm_state,
-- eeo_rpt_ind,
-- fac_address1,
-- fac_address2,
-- fac_callsign,
-- fac_channel,
-- fac_city,
-- fac_country,
-- fac_frequency,
-- fac_service,
-- fac_state,
-- fac_status_date,
-- fac_type,
-- facility_id,
-- lic_expiration_date,
-- fac_status,
-- fac_zip1,
-- fac_zip2,
-- station_type,
-- assoc_facility_id,
-- callsign_eff_date,
-- tsid_ntsc,
-- tsid_dtv,
-- digital_status,
-- sat_tv,
-- network_affil,
-- nielsen_dma,
-- tv_virtual_channel,
-- last_change_date,
-- nn1,
-- nn2

-- requires downloading facility.dat from
--   http://transition.fcc.gov/mb/databases/cdbs/
-- specifically,
--   http://transition.fcc.gov/ftp/Bureaus/MB/Databases/cdbs/facility.zip
-- and unzip

create table callsigns (comm_city, comm_state, eeo_rpt_ind, fac_address1, fac_address2, fac_callsign, fac_channel, fac_city, fac_country, fac_frequency, fac_service, fac_state, fac_status_date, fac_type, facility_id, lic_expiration_date, fac_status, fac_zip1, fac_zip2, station_type, assoc_facility_id, callsign_eff_date, tsid_ntsc, tsid_dtv, digital_status, sat_tv, network_affil, nielsen_dma, tv_virtual_channel, last_change_date, nn1, nn2);
.separator "|"
.import facility.dat callsigns

-- sample sqlite statement used ==>
-- SELECT * FROM callsigns WHERE fac_callsign != '' AND comm_city != '' AND comm_state != '' AND fac_country = 'US' AND fac_service in ("AM", "FM") ORDER BY RANDOM() LIMIT 1;