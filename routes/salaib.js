const { Router } = require('express');
const asyncHandler = require('express-async-handler');
const moment = require('moment');
const fetch = require('node-fetch');
const random = require('random');
const Account = require('../services/account');
const Transaction = require('../services/transaction');
const User = require('../services/user');
const Email = require('../services/email');
const Bank = require('../services/bank');
const InterestRate = require('../services/interest_rate');

const router = new Router();

// API
const API_URL = process.env.API_URL || 'http://localhost:3003';
const API_KEY_SLB = process.env.API_KEY_SLB || 'slb123';
let error_API = false;

async function request(method, path, body) {
    try {
        const res = await fetch(`${API_URL}${path}`, {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                Authorization: API_KEY_SLB,
            },
        });
        if (!res.ok) {
            const { error } = await res.json();
            throw Error(error);
        }
        error_API = false;
        return res.json();
    } catch (error) {
        error_API = true;
        console.log('Error_API: ', error);
    }
}

async function getBank() {
    return request('GET', '/');
}

async function createTransAPI(amount, currency, sourceBankId, destinationBankId, destinationAccount, note) {
    const trans = {
        amount,
        currency,
        sourceBankId,
        destinationBankId,
        destinationAccount,
        note
    };
    return request('POST', '/', { trans });
}

// SalaIB
router.get('/', (req, res) => {
    if (!req.currentUser) {
        return res.redirect('/');
    }
    if (req.currentUser && req.currentUser.isStaff) {
        return res.redirect('/admincp');
    }
    res.redirect('/salaib/Request?operationName=thong_tin_tai_khoan&operationNameChild=no_child');
});

router.get('/Request', asyncHandler(async (req, res) => {
    if (!req.currentUser) {
        return res.redirect('/');
    }
    if (req.currentUser && req.currentUser.isStaff) {
        return res.redirect('/admincp');
    }

    // GET - THONG TIN TAI KHOAN
    if (req.query.operationName === 'thong_tin_tai_khoan' && req.query.operationNameChild === 'no_child') {
        // GET - THONG TIN TAI KHOAN CHI TIET
        const allAccount = await Account.findAllAccount(req.currentUser.id);
        if (req.query.accountNbr) {
            const chkHaveAccount = await Account.findUserAccount(req.currentUser.id, req.query.accountNbr);
            if (chkHaveAccount.length == '') { return res.redirect('/') };

            const arr_trans = await Transaction.filterTransactionAccNum(req.query.accountNbr);
            let beginBalance = 0;
            let endBalance = 0;
            if (arr_trans.length != 0) {
                beginBalance = Number(arr_trans[0].current_balance) + Number(arr_trans[0].debited) - Number(arr_trans[0].credited);
                endBalance = Number(arr_trans[arr_trans.length - 1].current_balance);
            }
            const acc = await Account.findOne({ where: { account_number: req.query.accountNbr } });
            const currency = acc.currency;

            let sum_withdrawal = 0;
            let sum_deposit = 0;
            for (let i = 0; i < arr_trans.length; i++) {
                sum_withdrawal += Number(arr_trans[i].debited);
                sum_deposit += Number(arr_trans[i].credited);
            }

            return res.render('thong_tin_tai_khoan_chi_tiet', { account: allAccount, account_selected: req.query.accountNbr, arr_trans, fromDate: null, toDate: null, monthDate: moment().format('MM'), yearDate: moment().format('yyyy'), beginBalance, endBalance, sum_withdrawal, sum_deposit, currency, page_name: 'thong_tin_tai_khoan_chi_tiet' });
        }
        return res.render('thong_tin_tai_khoan', { tttk: allAccount, page_name: 'thong_tin_tai_khoan' });
    }

    const account = await Account.findPaymentAccount(req.currentUser.id);
    // GET - LIET KE GD ONLINE
    if (req.query.operationName === 'liet_ke_giao_dich_online' && req.query.operationNameChild === 'no_child') {
        const arr_trans = [];
        for (let i = 0; i < account.length; i++) {
            const trans = await Transaction.findAllTrans(account[i].id);
            trans.forEach(item => {
                arr_trans.push(item)
            });
        }
        arr_trans.sort((a, b) => { return new Date(b.date_create).getTime() - new Date(a.date_create).getTime(); });
        return res.render('liet_ke_giao_dich_online', { account, account_selected: req.body.account, account_status: 'all', arr_trans, fromDate: null, toDate: null, page_name: 'liet_ke_giao_dich_online' });

    }

    // GET - CHUYEN KHOAN TRONG SLB
    if (req.query.operationName === 'chuyen_khoan_trong_slb' && req.query.operationNameChild === 'no_child') {
        return res.render('chuyen_khoan_trong_slb', { account, account_selected: req.body.tktrichtien, tktrichtien: null, tkthuhuong: null, thtt_user: null, tktthuongUser: null, sotien: null, phigd: null, content: null, error: null, error_code: 0, page_name: 'chuyen_khoan_trong_slb' });
    }

    // GET - CHUYEN KHOAN NGOAI SLB
    if (req.query.operationName === 'chuyen_khoan_ngoai_slb' && req.query.operationNameChild === 'no_child') {
        const banks = await Bank.findAll();
        return res.render('chuyen_khoan_ngoai_slb', { account, account_selected: req.body.tktrichtien, tktrichtien: null, nganhang: null, banks, sotien: null, tkthuhuong: null, tendvthuhuong: null, content: null, phigd: null, chkd_NhanChiuPhi: 'N', errors: null, errors_code: null, page_name: 'chuyen_khoan_ngoai_slb' });
    }

    // GET - TIEN GUI CO KY HAN > Mo Tai Khoan
    if (req.query.operationName === 'tien_gui_co_ky_han' && req.query.operationNameChild === 'mo_tai_khoan') {
        const user = await User.findById(req.currentUser.id);
        return res.render('tien_gui_co_ky_han_motk', { user, account, account_selected: req.body.tktrichtien, tktrichtien: null, loaitgonline_selected: '0', laisuat: null, ngaydaohan: null, tienlaidukien: null, tongtiennhan: null, sotien: null, error: null, error_code: null, page_name: 'tien_gui_co_ky_han_motk' });
    }

    // GET - TIEN GUI CO KY HAN > Tat Toan Tai Khoan
    if (req.query.operationName === 'tien_gui_co_ky_han' && req.query.operationNameChild === 'tat_toan_tai_khoan') {
        const depositAccount = await Account.findDepositAccountgt0(req.currentUser.id);
        return res.render('tien_gui_co_ky_han_tattoan', { depositAccount, tktiengui: null, depositAccount_selected: null, account, account_selected: req.body.tkthanhtoan, sotientattoan: req.body.sotienTattoan, tkthanhtoan: null, sotien: null, errors: null, error_code: null, page_name: 'tien_gui_co_ky_han_tattoan' });
    }

    res.redirect('/');
}));

router.post('/Request', asyncHandler(async (req, res) => {
    const account = await Account.findPaymentAccount(req.currentUser.id);

    //POST - THONG TIN TAI KHOAN CHI TIET
    if (req.query.operationName === 'thong_tin_tai_khoan' && req.query.operationNameChild === 'no_child' && req.query.accountNbr) {
        const allAccount = await Account.findAllAccount(req.currentUser.id);
        const chkHaveAccount = await Account.findUserAccount(req.currentUser.id, req.body.accountNbr);
        if (chkHaveAccount.length == '') { return res.redirect('/') };
        let arr_trans;

        const fromDate = req.body.fromDate;
        const toDate = req.body.toDate;
        _fromDate = new Date(fromDate.split('/').reverse().join('/') + ' 00:00:00').toISOString();
        _toDate = new Date(toDate.split('/').reverse().join('/') + ' 23:59:59').toISOString();

        if (req.body.btnViewDay) {
            arr_trans = await Transaction.filterTransactionAccNumDate(req.body.accountNbr, _fromDate, _toDate);
        }
        else {
            arr_trans = await Transaction.filterTransactionAccNumMonth(req.body.accountNbr, req.body.monthDate, req.body.yearDate);
        }

        let beginBalance = 0;
        let endBalance = 0;
        const acc = await Account.findOne({ where: { account_number: req.body.accountNbr } });
        const currency = acc.currency;
        let sum_withdrawal = 0;
        let sum_deposit = 0;
        if (arr_trans.length != '') {
            beginBalance = Number(arr_trans[0].current_balance) + Number(arr_trans[0].debited) - Number(arr_trans[0].credited);
            endBalance = Number(arr_trans[arr_trans.length - 1].current_balance);

            for (let i = 0; i < arr_trans.length; i++) {
                sum_withdrawal += Number(arr_trans[i].debited);
                sum_deposit += Number(arr_trans[i].credited);
            }
        }

        return res.render('thong_tin_tai_khoan_chi_tiet', { account: allAccount, account_selected: req.body.accountNbr, arr_trans, fromDate, toDate, monthDate: req.body.monthDate, yearDate: req.body.yearDate, beginBalance, endBalance, sum_withdrawal, sum_deposit, currency, page_name: 'thong_tin_tai_khoan_chi_tiet' });
    }

    // POST - LIET KE GD ONLINE
    if (req.query.operationName === 'liet_ke_giao_dich_online' && req.query.operationNameChild === 'no_child') {
        const fromDate = req.body.fromDate;
        const toDate = req.body.toDate;
        _fromDate = new Date(fromDate.split('/').reverse().join('/') + ' 00:00:00').toISOString();
        _toDate = new Date(toDate.split('/').reverse().join('/') + ' 23:59:59').toISOString();
        dp_fromDate = Date.parse(_fromDate);
        dp_toDate = Date.parse(_toDate);

        const arr_trans = [];
        for (let i = 0; i < account.length; i++) {
            const trans = await Transaction.findAllTrans(account[i].id);
            trans.forEach(item => {
                arr_trans.push(item)
            });
        }
        arr_trans.sort((a, b) => { return new Date(b.date_create).getTime() - new Date(a.date_create).getTime(); });

        const filtered = [];
        for (let i = 0; i < arr_trans.length; i++) {
            const btw_date = dp_fromDate <= Date.parse(arr_trans[i].date_create) && Date.parse(arr_trans[i].date_create) <= dp_toDate;
            if (req.body.account == 'all' && req.body.status == 'all' && btw_date) {
                filtered.push(arr_trans[i]);
            }
            else if (req.body.account == 'all') {
                if (req.body.status == arr_trans[i].status && btw_date) {
                    filtered.push(arr_trans[i]);
                }
            }
            else if (req.body.status == 'all') {
                if (req.body.account == arr_trans[i].from_account_number && btw_date) {
                    filtered.push(arr_trans[i]);
                }
            }
            else {
                if (req.body.account == arr_trans[i].from_account_number && req.body.status == arr_trans[i].status && btw_date) {
                    filtered.push(arr_trans[i]);
                }
            }
        }
        return res.render('liet_ke_giao_dich_online', { account, account_selected: req.body.account, account_status: req.body.status, arr_trans: filtered, fromDate, toDate, page_name: 'liet_ke_giao_dich_online' });
    }

    // POST - CHUYEN KHOAN TRONG SLB
    if (req.query.operationName === 'chuyen_khoan_trong_slb' && req.query.operationNameChild === 'no_child') {
        const tktt = await Account.findOne({ where: { account_number: req.body.tktrichtien } });
        let thtt_user;
        if (tktt) { thtt_user = await User.findOne({ where: { id: tktt.userId } }) };
        const tkth = await Account.findOne({ where: { account_number: req.body.tkthuhuong } });
        let thth_user;
        if (tkth) { thth_user = await User.findOne({ where: { id: tkth.userId } }) };
        let sotien = req.body.sotien;
        sotien = sotien.replace(/,/g, '.');
        let _sotien = req.body.sotien;
        _sotien = _sotien.replace(/,/g, '');
        _sotien = _sotien.replace(/\./g, '');
        const phigd = 0;
        let content = req.body.noidunggd;

        // Auth Trans - Go Back
        if (req.body.btnGoback) {
            let content = req.body.content;
            content = content.replace('IB ' + thtt_user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase() + ' ', '');
            return res.render('chuyen_khoan_trong_slb', { account, account_selected: req.body.tktrichtien, tktrichtien: tktt, tkthuhuong: tkth, thtt_user, tktthuongUser: thth_user, sotien: new Intl.NumberFormat('vi').format(sotien), phigd: new Intl.NumberFormat('vi').format(req.body.phigd), content, error: null, error_code: null, page_name: 'chuyen_khoan_trong_slb' });
        }

        // Result - Auth Trans
        if (req.body.btnAuthOK) {
            const auth_errors = [];
            const user = await User.findById(req.currentUser.id);
            if (!user || !User.verifyPassword(req.body.auth_password, user.password)) {
                auth_errors.push('Sai mật khẩu đăng nhập!');
            }
            const auth_trans = await Transaction.findOne({ where: { trans_code: req.body.trans_code, OTP_code: req.body.auth_otp_email } });
            if (!auth_trans) {
                auth_errors.push('Sai mã OTP Email!');
            }

            if (auth_trans && auth_trans.status == 'GD đã hoàn tất') {
                return res.redirect('/');
            }

            if (auth_errors.length != 0) {
                const _auth_trans = await Transaction.findOne({ where: { trans_code: req.body.trans_code } });
                await _auth_trans.NotdoneDebitedTrans();
                return res.render('result_trans', { auth_errors, mark: 'trong', page_name: 'result_trans' });
            }

            const currBalanceDebit = Number(tktt.current_balance) - Number(req.body.sotien);
            const avaiBalanceDebit = Number(tktt.available_balance) - Number(req.body.sotien);
            await auth_trans.doneDebitedTrans(currBalanceDebit);
            await tktt.updateBalance(currBalanceDebit, avaiBalanceDebit);
            await Email.send(thtt_user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - Kính gửi Quý khách hàng.<br>SLB trân trọng thông báo tài khoản <b>${tktt.account_number}</b> của Quý khách đã thay đổi số dư như sau:<br>Số dư mới của tài khoản trên là: <b>${new Intl.NumberFormat('vi').format(tktt.current_balance)} ${tktt.currency}</b> tính đến <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao dịch mới nhất: Ghi nợ <b>-${new Intl.NumberFormat('vi').format(req.body.sotien)} ${tktt.currency}</b>.<br>Nội dung giao dịch: <b>${req.body.content}</b>.<br><br>Cảm ơn Quý khách hàng đã sử dụng Sản phẩm/ Dịch vụ của SLB.<br>Chúng tôi mong được tiếp tục phục vụ Quý khách hàng.<br>Trân trọng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>Đây là dịch vụ Email tự động của SLB, Quý khách vui lòng không "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

            const currBalanceCredit = Number(tkth.current_balance) + Number(req.body.sotien);
            const avaiBalanceCredit = Number(tkth.available_balance) + Number(req.body.sotien);
            await Transaction.add(req.body.trans_code + 'c', 'Trong hệ thống SLB', req.body.tktrichtien, req.body.tkthuhuong, req.body.beneficiary_unit, null, null, Number(req.body.sotien), phigd, req.body.content, currBalanceCredit, 'GD đã hoàn tất', false, null, true, tktt.id);
            await tkth.updateBalance(currBalanceCredit, avaiBalanceCredit);
            await Email.send(thth_user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - Kính gửi Quý khách hàng.<br>SLB trân trọng thông báo tài khoản <b>${tkth.account_number}</b> của Quý khách đã thay đổi số dư như sau:<br>Số dư mới của tài khoản trên là: <b>${new Intl.NumberFormat('vi').format(tkth.current_balance)} ${tkth.currency}</b> tính đến <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao dịch mới nhất: Ghi có <b>+${new Intl.NumberFormat('vi').format(req.body.sotien)} ${tkth.currency}</b>.<br>Nội dung giao dịch: <b>${req.body.content}</b>.<br><br>Cảm ơn Quý khách hàng đã sử dụng Sản phẩm/ Dịch vụ của SLB.<br>Chúng tôi mong được tiếp tục phục vụ Quý khách hàng.<br>Trân trọng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>Đây là dịch vụ Email tự động của SLB, Quý khách vui lòng không "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

            return res.render('result_trans', { auth_errors: null, mark: 'trong', page_name: 'result_trans' });
        }

        // Catch Errors
        let error;
        let error_code;
        if (!tktt) { error = 'Chưa chọn tài khoản trích tiền.'; error_code = 1; }
        else {
            if (req.body.tkthuhuong == '') { error = 'Vui lòng nhập số tài khoản thụ hưởng!'; error_code = 2; }
            else if (!req.body.tkthuhuong.startsWith('2')) {
                error = 'Không thể chuyển khoản cho tài khoản này!';
                error_code = 2;
            }
            else if (!tkth) {
                error = 'Tài khoản thụ hưởng ' + req.body.tkthuhuong + ' không tồn tại!';
                error_code = 2;
            }
            else if (tkth && tkth.account_number == req.body.tktrichtien) {
                error = 'Không thể chuyển khoản cho tài khoản trích tiền!';
                error_code = 2;
            }
            else {
                if (!req.body.sotien) {
                    error = 'Vui lòng nhập số tiền muốn chuyển.';
                    error_code = 3;
                }
                else if (Number(_sotien) < 5000) {
                    error = 'Số tiền tối thiểu là 5.000 đồng';
                    error_code = 3;
                }
                else if (Number(_sotien) > Number(tktt.transfer_limit)) {
                    error = `Số tiền vượt quá hạn mức tối đa: ${new Intl.NumberFormat('vi').format(tktt.transfer_limit) + ' ' + tktt.currency}`;
                    error_code = 3;
                }
                else if (Number(_sotien) > Number(tktt.available_balance)) {
                    error = 'Số dư khả dụng hiện tại của bạn không đủ!';
                    error_code = 3;
                }
                else {
                    if (req.body.chuyenkhoanngay != 'on') {
                        error = 'Vui lòng chọn thời gian chuyển!';
                        error_code = 4;
                    }
                    else {
                        if (req.body.ppxacthuc == '') {
                            error = 'Vui lòng nhập Nội dung giao dịch (nếu có) rồi chọn Phương pháp xác thực!';
                            error_code = 5;
                        }
                    }
                }
            }
        }

        // Render
        if (error != null) {
            return res.render('chuyen_khoan_trong_slb', { account, account_selected: req.body.tktrichtien, tktrichtien: tktt, tkthuhuong: tkth, thtt_user, tktthuongUser: thth_user, sotien, phigd, content, error, error_code, page_name: 'chuyen_khoan_trong_slb' });
        }

        const OTP_code = random.int(min = 1000000, max = 9999999).toString();
        let _trans;
        let trans_code;
        do {
            trans_code = random.int(min = 111111111, max = 999999999).toString();
            _trans = await Transaction.findOne({ where: { trans_code } });
        } while (_trans);

        if (!content) {
            content = 'IB ' + req.body.glbHoTenKH + ' CK ' + req.body.beneficiary_unit;
        }
        else {
            content = 'IB ' + req.body.glbHoTenKH + ' ' + req.body.noidunggd.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
        }

        await Transaction.add(trans_code, 'Trong hệ thống SLB', req.body.tktrichtien, req.body.tktrichtien, req.body.beneficiary_unit, null, _sotien, null, phigd, content, null, 'GD đang chờ xử lý', false, OTP_code, false, tktt.id);
        trans = await Transaction.findOne({ where: { trans_code } });
        await Email.send(thtt_user.email, 'SalaBank - Internet Banking - OTP Verification <no-reply>', `SLB Online: Mã xác thực OTP của giao dịch <b>${trans.trans_code}</b> là <b>${trans.OTP_code}</b>. Quý khách đang thực hiện Chuyển khoản trong SLB, số tiền: <b>${trans.debited ? new Intl.NumberFormat('vi').format(trans.debited) : new Intl.NumberFormat('vi').format(trans.credited)} ${tktt.currency}</b>.`);

        return res.render('auth_trans', { trans, auth_tktt: tktt, auth_tkth: req.body.tkthuhuong, page_name: 'auth_trans' });
    }

    // POST - CHUYEN KHOAN NGOAI SLB
    if (req.query.operationName === 'chuyen_khoan_ngoai_slb' && req.query.operationNameChild === 'no_child') {
        const tktt = await Account.findOne({ where: { account_number: req.body.tktrichtien } });
        let thtt_user;
        if (tktt) { thtt_user = await User.findOne({ where: { id: tktt.userId } }) };
        const banks = await Bank.findAll();
        const nganhang = req.body.nganhang;
        const tkthuhuong = req.body.tkthuhuong;
        const tendvthuhuong = req.body.tendvthuhuong;
        let sotien = req.body.sotien;
        sotien = sotien.replace(/,/g, '.');
        let _sotien = req.body.sotien;
        _sotien = _sotien.replace(/,/g, '');
        _sotien = _sotien.replace(/\./g, '');
        let phigd;
        if (!_sotien || _sotien == 0) {
            phigd = null;
        }
        else { phigd = 7500; }
        let content = req.body.noidunggd;

        if (req.body.btnAuthOK) {
            const auth_errors = [];
            const user = await User.findById(req.currentUser.id);
            if (!user || !User.verifyPassword(req.body.auth_password, user.password)) {
                auth_errors.push('Sai mật khẩu đăng nhập!');
            }
            const auth_trans = await Transaction.findOne({ where: { trans_code: req.body.trans_code, OTP_code: req.body.auth_otp_email } });
            if (!auth_trans) {
                auth_errors.push('Sai mã OTP Email!');
            }

            if (auth_trans && auth_trans.status == 'GD đã hoàn tất') {
                return res.redirect('/');
            }

            if (auth_errors.length != 0) {
                const _auth_trans = await Transaction.findOne({ where: { trans_code: req.body.trans_code } });
                await _auth_trans.NotdoneDebitedTrans();
                return res.render('result_trans', { auth_errors, mark: 'ngoai', page_name: 'result_trans' });
            }

            const currBalanceDebit = Number(tktt.current_balance) - Number(req.body.sotien);
            const avaiBalanceDebit = Number(tktt.available_balance) - Number(req.body.sotien);
            await auth_trans.doneDebitedTrans(currBalanceDebit);
            await tktt.updateBalance(currBalanceDebit, avaiBalanceDebit);
            await Email.send(thtt_user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - Kính gửi Quý khách hàng.<br>SLB trân trọng thông báo tài khoản <b>${tktt.account_number}</b> của Quý khách đã thay đổi số dư như sau:<br>Số dư mới của tài khoản trên là: <b>${new Intl.NumberFormat('vi').format(tktt.current_balance)} ${tktt.currency}</b> tính đến <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao dịch mới nhất: Ghi nợ <b>-${new Intl.NumberFormat('vi').format(req.body.sotien)} ${tktt.currency}</b>.<br>Nội dung giao dịch: <b>${req.body.content}</b>.<br><br>Cảm ơn Quý khách hàng đã sử dụng Sản phẩm/ Dịch vụ của SLB.<br>Chúng tôi mong được tiếp tục phục vụ Quý khách hàng.<br>Trân trọng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>Đây là dịch vụ Email tự động của SLB, Quý khách vui lòng không "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

            // Fee
            if (req.body.NhanChiuPhi == 'N') {
                let _trans;
                let trans_code;
                do {
                    trans_code = random.int(min = 111111111, max = 999999999).toString();
                    _trans = await Transaction.findOne({ where: { trans_code } });
                } while (_trans);

                const _content = 'THU PHI DICH VU SLB ONLINE ' + req.body.trans_code + ' ' + moment().format("DD/MM/YY HH:mm:ss");

                await Transaction.add(trans_code, 'Trong hệ thống SLB', req.body.tktrichtien, req.body.tktrichtien, 'SLB ONLINE', null, req.body.phigd, null, 0, _content, null, 'GD đang chờ xử lý', false, null, false, tktt.id);
                trans = await Transaction.findOne({ where: { trans_code } });

                const currBalanceDebit = Number(tktt.current_balance) - Number(req.body.phigd);
                const avaiBalanceDebit = Number(tktt.available_balance) - Number(req.body.phigd);
                await trans.doneDebitedTrans(currBalanceDebit);
                await tktt.updateBalance(currBalanceDebit, avaiBalanceDebit);
                await Email.send(thtt_user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - Kính gửi Quý khách hàng.<br>SLB trân trọng thông báo tài khoản <b>${tktt.account_number}</b> của Quý khách đã thay đổi số dư như sau:<br>Số dư mới của tài khoản trên là: <b>${new Intl.NumberFormat('vi').format(tktt.current_balance)} ${tktt.currency}</b> tính đến <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao dịch mới nhất: Ghi nợ <b>-${new Intl.NumberFormat('vi').format(req.body.phigd)} ${tktt.currency}</b>.<br>Nội dung giao dịch: <b>${trans.content}</b>.<br><br>Cảm ơn Quý khách hàng đã sử dụng Sản phẩm/ Dịch vụ của SLB.<br>Chúng tôi mong được tiếp tục phục vụ Quý khách hàng.<br>Trân trọng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>Đây là dịch vụ Email tự động của SLB, Quý khách vui lòng không "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

                // POST API - TRANS
                const api_trans = await createTransAPI(req.body.sotien, tktt.currency, 'SLB', req.body.toBank, req.body.tkthuhuong, req.body.content);
                console.log(api_trans);
            }
            if (req.body.NhanChiuPhi == 'Y') {
                // POST API - TRANS
                const api_trans = await createTransAPI(Number(req.body.sotien) - Number(req.body.phigd), tktt.currency, 'SLB', req.body.toBank, req.body.tkthuhuong, req.body.content);
                console.log(api_trans);
            }

            return res.render('result_trans', { auth_errors: null, mark: 'ngoai', page_name: 'result_trans' });
        }

        if (req.body.btnStep) {
            return res.render('chuyen_khoan_ngoai_slb', { account, account_selected: req.body.tktrichtien, tktrichtien: tktt, nganhang, banks, tkthuhuong, tendvthuhuong, sotien, phigd, chkd_NhanChiuPhi: req.body.NhanChiuPhiYN, content, errors: null, errors_code: null, page_name: 'chuyen_khoan_ngoai_slb' });
        }

        // Catch Errors
        const errors = [];
        const errors_code = [];
        if (!tktt) { errors.push('Chưa chọn tài khoản trích tiền.'); errors_code.push(1); }
        else {
            if (req.body.nganhang == '0' || req.body.tkthuhuong == '' || req.body.tendvthuhuong == '') {
                errors.push('Vui lòng kiểm tra lại Thông tin đơn vị thụ hưởng.'); errors_code.push(2);
            }
            await getBank();
            if (error_API) {
                errors.push('Lỗi hệ thống! SalaBank không tồn tại trên Napas.'); errors_code.push(3);
            }
            if (req.body.sotien == '') {
                errors.push('Vui lòng nhập số tiền.');
                errors_code.push(4);
            }
            else if (Number(_sotien) < 5000) {
                errors.push('Số tiền tối thiểu là 5.000 đồng');
                errors_code.push(4);
            }
            else if (Number(_sotien) > Number(tktt.transfer_limit)) {
                errors.push(`Số tiền vượt quá hạn mức tối đa: ${new Intl.NumberFormat('vi').format(tktt.transfer_limit) + ' ' + tktt.currency}`);
                errors_code.push(4);
            }
            else if (Number(_sotien) > Number(tktt.available_balance)) {
                errors.push('Số dư khả dụng hiện tại của bạn không đủ!');
                errors_code.push(4);
            }
            if (req.body.ppxacthuc == '') {
                errors.push('Vui lòng nhập Nội dung giao dịch (nếu có) rồi chọn Phương pháp xác thực!');
                errors_code.push(5);
            }
        }

        // Render errors
        if (errors.length != 0) {
            return res.render('chuyen_khoan_ngoai_slb', { account, account_selected: req.body.tktrichtien, tktrichtien: tktt, nganhang, banks, tkthuhuong, tendvthuhuong, sotien, phigd, chkd_NhanChiuPhi: req.body.NhanChiuPhiYN, content, errors, errors_code, page_name: 'chuyen_khoan_ngoai_slb' });
        }

        const _bank = await Bank.findOne({ where: { bankId: req.body.nganhang } });

        const OTP_code = random.int(min = 1000000, max = 9999999).toString();
        let _trans;
        let trans_code;
        do {
            trans_code = random.int(min = 111111111, max = 999999999).toString();
            _trans = await Transaction.findOne({ where: { trans_code } });
        } while (_trans);

        const _content = req.body.noidunggd.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase() + ' GD ' + trans_code + ' ' + moment().format("DD/MM/YY HH:mm:ss");

        await Transaction.add(trans_code, 'Ngoài hệ thống SLB', req.body.tktrichtien, req.body.tktrichtien, req.body.tendvthuhuong, req.body.nganhang, _sotien, null, phigd, _content, null, 'GD đang chờ xử lý', true, OTP_code, false, tktt.id);
        trans = await Transaction.findOne({ where: { trans_code } });
        await Email.send(thtt_user.email, 'SalaBank - Internet Banking - OTP Verification <no-reply>', `SLB Online: Mã xác thực OTP của giao dịch <b>${trans.trans_code}</b> là <b>${trans.OTP_code}</b>. Quý khách đang thực hiện Chuyển khoản NGOÀI SLB, số tiền: <b>${trans.debited ? new Intl.NumberFormat('vi').format(trans.debited) : new Intl.NumberFormat('vi').format(trans.credited)} ${tktt.currency}</b>.`);

        return res.render('auth_trans_out', { trans, auth_tktt: tktt, auth_tkth: req.body.tkthuhuong, bank: _bank, NhanChiuPhi: req.body.NhanChiuPhiYN, page_name: 'auth_trans_out' });
    }

    // POST - TIEN GUI CO KY HAN > Mo Tai Khoan
    if (req.query.operationName === 'tien_gui_co_ky_han' && req.query.operationNameChild === 'mo_tai_khoan') {
        const user = await User.findById(req.currentUser.id);
        const tktt = await Account.findOne({ where: { account_number: req.body.tktrichtien } });

        let _sotien = req.body.sotien_tgonline;
        _sotien = _sotien.replace(/,/g, '');
        _sotien = _sotien.replace(/\./g, '');

        if (req.body.btnAuthOK_deposit) {
            if (!user || !User.verifyPassword(req.body.auth_password, user.password)) {
                return res.render('result_deposit_onilne', { error: 'Sai mật khẩu đăng nhập!', page_name: 'result_deposit_onilne' });
            }

            const currBalanceDebit = Number(tktt.current_balance) - Number(_sotien);
            const avaiBalanceDebit = Number(tktt.available_balance) - Number(_sotien);
            const ngaydaohanISO = new Date(req.body.ngaydaohan.split('/').reverse().join('/')).toISOString();

            let trans_code;
            do {
                trans_code = random.int(min = 111111111, max = 999999999).toString();
                _trans = await Transaction.findOne({ where: { trans_code } });
            } while (_trans);

            let stk_tgonline;
            do {
                stk_tgonline = random.int(min = 11111111, max = 99999999).toString();
                stk_tgonline = '3' + stk_tgonline;
                _stk_tgonline = await Account.findOne({ where: { account_number: stk_tgonline } });
            } while (_stk_tgonline);

            await Transaction.add(trans_code, 'Trong hệ thống SLB', req.body.tktrichtien, req.body.tktrichtien, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase(), null, _sotien, null, 0, `TRICH TK ${tktt.account_number} MO ${req.body.loaitgonline}`, currBalanceDebit, 'GD đã hoàn tất', false, null, true, tktt.id);
            await Account.add(stk_tgonline, tktt.account_opening_unit, _sotien, _sotien, 'VND', ngaydaohanISO, new Date(), null, req.body.code_loaitgonline, req.body.laisuat, req.body.tienlaidukien, req.body.loaitgonline.replace(' VND', ''), 0, false, user.id);
            await Transaction.add(trans_code + 'c', 'Trong hệ thống SLB', req.body.tktrichtien, stk_tgonline, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase(), null, null, _sotien, 0, `TRICH TK ${tktt.account_number} MO ${req.body.loaitgonline}`, _sotien, 'GD đã hoàn tất', false, null, true, tktt.id);

            const auth_trans = await Transaction.findOne({ where: { trans_code } });

            const promise1 = auth_trans.doneDebitedTrans(currBalanceDebit);
            const promise2 = tktt.updateBalance(currBalanceDebit, avaiBalanceDebit);
            const promise3 = Email.send(user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - Kính gửi Quý khách hàng.<br>SLB trân trọng thông báo tài khoản <b>${tktt.account_number}</b> của Quý khách đã thay đổi số dư như sau:<br>Số dư mới của tài khoản trên là: <b>${new Intl.NumberFormat('vi').format(tktt.current_balance)} ${tktt.currency}</b> tính đến <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao dịch mới nhất: Ghi nợ <b>-${new Intl.NumberFormat('vi').format(_sotien)} ${tktt.currency}</b>.<br>Nội dung giao dịch: <b>TRICH TK ${tktt.account_number} MO ${req.body.loaitgonline}</b>.<br><br>Cảm ơn Quý khách hàng đã sử dụng Sản phẩm/ Dịch vụ của SLB.<br>Chúng tôi mong được tiếp tục phục vụ Quý khách hàng.<br>Trân trọng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>Đây là dịch vụ Email tự động của SLB, Quý khách vui lòng không "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

            await Promise.all([promise3, promise1, promise2]);

            return res.render('result_deposit_onilne', { error: null, page_name: 'result_deposit_onilne' });
        }

        const laisuat = await InterestRate.findOne({ where: { type_deposit: 'TG ONLINE', year: moment().format('YYYY'), period: req.body.loaitgonline } });
        let ngaydaohan = null;
        let tienlaidukien = null;

        if (req.body.loaitgonline == '1w') {
            _loaiTienguiOnline = 'TG ONLINE 1 TUAN VND';
            ngaydaohan = moment().add(7, 'd').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * 7);
        }
        if (req.body.loaitgonline == '2w') {
            _loaiTienguiOnline = 'TG ONLINE 2 TUAN VND';
            ngaydaohan = moment().add(14, 'd').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * 14);
        }
        if (req.body.loaitgonline == '3w') {
            _loaiTienguiOnline = 'TG ONLINE 3 TUAN VND';
            ngaydaohan = moment().add(21, 'd').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * 21);
        }
        if (req.body.loaitgonline == '1m') {
            _loaiTienguiOnline = 'TG ONLINE 1 THANG VND';
            ngaydaohan = moment().add(1, 'M').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * moment().add(1, 'M').diff(moment(), 'days'));
        }
        if (req.body.loaitgonline == '2m') {
            _loaiTienguiOnline = 'TG ONLINE 2 THANG VND';
            ngaydaohan = moment().add(2, 'M').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * moment().add(2, 'M').diff(moment(), 'days'));
        }
        if (req.body.loaitgonline == '3m') {
            _loaiTienguiOnline = 'TG ONLINE 3 THANG VND';
            ngaydaohan = moment().add(3, 'M').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * moment().add(3, 'M').diff(moment(), 'days'));
        }
        if (req.body.loaitgonline == '6m') {
            _loaiTienguiOnline = 'TG ONLINE 6 THANG VND';
            ngaydaohan = moment().add(6, 'M').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * moment().add(6, 'M').diff(moment(), 'days'));
        }
        if (req.body.loaitgonline == '9m') {
            _loaiTienguiOnline = 'TG ONLINE 9 THANG VND';
            ngaydaohan = moment().add(9, 'M').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * moment().add(9, 'M').diff(moment(), 'days'));
        }
        if (req.body.loaitgonline == '12m') {
            _loaiTienguiOnline = 'TG ONLINE 12 THANG VND';
            ngaydaohan = moment().add(12, 'M').format('DD/MM/yyyy');
            tienlaidukien = Math.round(Number(_sotien) * Number((laisuat.annual_interest_rate / 100) / 365) * moment().add(12, 'M').diff(moment(), 'days'));
        }
        const tongtiennhan = Number(_sotien) + tienlaidukien;

        // Catch Errors
        let error;
        let error_code;
        if (!tktt) {
            error = 'Chưa chọn tài khoản trích tiền.'; error_code = 1;
        }
        else if (req.body.loaitgonline == '0') {
            error = 'Chưa chọn loại tiền gửi có kỳ hạn.'; error_code = 2;
        }
        else if (req.body.sotien_tgonline == '') {
            error = 'Vui lòng nhập số tiền.'; error_code = 3;
        }
        else if (Number(_sotien) < 1000000) {
            error = 'Số tiền gửi có kỳ hạn phải ít nhất: 1.000.000 VND'; error_code = 3;
        }
        else if (Number(_sotien) > Number(tktt.available_balance)) {
            error = 'Số tiền gửi vượt quá số dư hiện có.'; error_code = 3;
        }
        else if (!req.body.auth_tgonline) {
            error = 'Vui lòng xác nhận đồng ý với thỏa thuận điều khoản chung.'; error_code = 4;
        };

        // Render
        if (error != null) {
            return res.render('tien_gui_co_ky_han_motk', { user, account, account_selected: req.body.tktrichtien, loaitgonline_selected: req.body.loaitgonline, laisuat, ngaydaohan, tienlaidukien, tongtiennhan, tktrichtien: tktt, sotien: req.body.sotien_tgonline, error, error_code, page_name: 'tien_gui_co_ky_han_motk' });
        }

        return res.render('auth_deposit', { tktt, sanpham: _loaiTienguiOnline, code_sanpham: req.body.loaitgonline, laisuat: req.body.annual_interest_rate, sotien: req.body.sotien_tgonline, ngaydaohan: req.body.date_due, tienlaidukien, error: null, page_name: 'auth_deposit' });
    }

    // POST - TIEN GUI CO KY HAN > Tat Toan Tai Khoan
    if (req.query.operationName === 'tien_gui_co_ky_han' && req.query.operationNameChild === 'tat_toan_tai_khoan') {
        if (req.body.btnAuthOK_f) {
            const tktattoan = await Account.findOne({ where: { account_number: req.body.tktattoan } });
            const tktt = await Account.findOne({ where: { account_number: req.body.tkthanhtoan } });
            const sotientt = req.body.sotienTattoan;
            const auth_errors = [];
            const user = await User.findById(req.currentUser.id);
            if (!user || !User.verifyPassword(req.body.auth_password, user.password)) {
                auth_errors.push('Sai mật khẩu đăng nhập!');
                return res.render('result_finalization', { error: auth_errors, page_name: 'result_finalization' });
            }

            const currBalanceDebit = Number(tktattoan.current_balance) - Number(sotientt);
            const avaiBalanceDebit = Number(tktattoan.available_balance) - Number(sotientt);

            let trans_code;
            do {
                trans_code = random.int(min = 111111111, max = 999999999).toString();
                _trans = await Transaction.findOne({ where: { trans_code } });
            } while (_trans);

            await Transaction.add(trans_code, 'Trong hệ thống SLB', req.body.tktattoan, req.body.tktattoan, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase(), null, sotientt, null, 0, `TAT TOAN TK ${tktattoan.account_number} VAO TKTG ${req.body.tkthanhtoan}`, currBalanceDebit, 'GD đã hoàn tất', false, null, true, tktattoan.id);
            await tktattoan.updateBalance(currBalanceDebit, avaiBalanceDebit);

            const currBalanceCredit = Number(tktt.current_balance) + Number(sotientt);
            const avaiBalanceCredit = Number(tktt.available_balance) + Number(sotientt);


            const promise1 = await Transaction.add(trans_code + 'c', 'Trong hệ thống SLB', req.body.tktattoan, req.body.tkthanhtoan, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase(), null, null, sotientt, 0, `TAT TOAN TK ${tktattoan.account_number} VAO TKTG ${req.body.tkthanhtoan}`, currBalanceCredit, 'GD đã hoàn tất', false, null, true, tktattoan.id);
            const promise2 = await tktt.updateBalance(currBalanceCredit, avaiBalanceCredit);
            const promise3 = Email.send(user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - Kính gửi Quý khách hàng.<br>SLB trân trọng thông báo tài khoản <b>${tktt.account_number}</b> của Quý khách đã thay đổi số dư như sau:<br>Số dư mới của tài khoản trên là: <b>${new Intl.NumberFormat('vi').format(tktt.current_balance)} ${tktt.currency}</b> tính đến <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao dịch mới nhất: Ghi có <b>+${new Intl.NumberFormat('vi').format(sotientt)} ${tktt.currency}</b>.<br>Nội dung giao dịch: <b>TAT TOAN TK ${tktattoan.account_number} VAO TKTG ${req.body.tkthanhtoan}</b>.<br><br>Cảm ơn Quý khách hàng đã sử dụng Sản phẩm/ Dịch vụ của SLB.<br>Chúng tôi mong được tiếp tục phục vụ Quý khách hàng.<br>Trân trọng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>Đây là dịch vụ Email tự động của SLB, Quý khách vui lòng không "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

            await Promise.all([promise3, promise1, promise2]);

            return res.render('result_finalization', { error: null, page_name: 'result_finalization' });
        }

        const depositAccount = await Account.findDepositAccountgt0(req.currentUser.id);
        const tktiengui = await Account.findOne({ where: { account_number: req.body.tktiengui } });

        if (req.body.btnStep) {
            return res.render('tien_gui_co_ky_han_tattoan', { depositAccount, tktiengui, depositAccount_selected: req.body.tktiengui, account, account_selected: req.body.tkthanhtoan, sotientattoan: req.body.sotienTattoan, tktrichtien: null, errors: null, error_code: null, page_name: 'tien_gui_co_ky_han_tattoan' });
        }

        // Catch Errors
        const errors = [];
        const error_code = [];
        if (req.body.tktiengui == 0) { errors.push('Chưa chọn tài khoản tiền gửi.'); error_code.push(1); };
        if (req.body.tkthanhtoan == 0) { errors.push('Chưa chọn tài khoản thanh toán.'); error_code.push(2); };
        if (req.body.ppxacthuc == '') { errors.push('Chưa chọn phương pháp xác thực.'); error_code.push(3); };

        // Render errors
        if (errors.length != 0) {
            return res.render('tien_gui_co_ky_han_tattoan', { depositAccount, tktiengui, depositAccount_selected: req.body.tktiengui, account, account_selected: req.body.tkthanhtoan, sotientattoan: req.body.sotienTattoan, tktrichtien: null, errors, error_code, page_name: 'tien_gui_co_ky_han_tattoan' });
        }

        return res.render('auth_finalization', { tktattoan: req.body.tktiengui, tkthanhtoan: req.body.tkthanhtoan, sotientattoan: req.body.sotienTattoan, page_name: 'auth_finalization' });
    }
}));

module.exports = router;